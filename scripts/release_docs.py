import json
import os
import re
import subprocess
import tempfile
import uuid

STABLE = re.compile(r"v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\Z")
DIFF_LIMIT = 100_000
TRUNCATED = "\n\n... [diff truncated at 100000 characters]"


def previous_stable_tag(tags: list[str], tag: str) -> str | None:
    current = STABLE.fullmatch(tag)
    if not current:
        raise ValueError("RELEASE_TAG must be a stable vX.Y.Z tag")
    version = tuple(map(int, current.groups()))
    candidates = {}
    for candidate in tags:
        match = STABLE.fullmatch(candidate)
        if match and tuple(map(int, match.groups())) < version:
            candidates[tuple(map(int, match.groups()))] = candidate
    return candidates[max(candidates)] if candidates else None


def git(*args: str, cwd: str | None = None) -> str:
    return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()


def release_diff(tag: str, previous: str | None, cwd: str | None = None) -> str:
    start = f"refs/tags/{previous}" if previous else git("hash-object", "-t", "tree", "/dev/null", cwd=cwd)
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8", errors="replace") as output:
        subprocess.run(["git", "diff", start, f"refs/tags/{tag}"], cwd=cwd, stdout=output, check=True)
        output.seek(0)
        diff = output.read(DIFF_LIMIT + 1)
    return diff[:DIFF_LIMIT].replace("\0", "") + (TRUNCATED if len(diff) > DIFF_LIMIT else "")


def main() -> None:
    tag = os.environ["RELEASE_TAG"]
    previous = previous_stable_tag(git("tag", "--list", "v*").splitlines(), tag)
    git("rev-parse", "--verify", f"refs/tags/{tag}^{{commit}}")
    release = json.loads(subprocess.check_output([
        "gh", "api", f"repos/{os.environ['GITHUB_REPOSITORY']}/releases/tags/{tag}"
    ], text=True))
    if release["prerelease"] or release["draft"] or release["tag_name"] != tag:
        raise ValueError("Documentation requires a published stable release")
    reviewers = set()
    for path in [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"]:
        if git("ls-tree", "--name-only", tag, "--", path):
            reviewers = {
                owner[1:]
                for line in git("show", f"refs/tags/{tag}:{path}").splitlines()
                for owner in line.split("#", 1)[0].split()[1:]
                if owner.startswith("@")
            }
            break
    context = {
        "version": tag[1:], "release_tag": tag, "release_notes": release["body"] or "",
        "changes_diff": release_diff(tag, previous), "reviewers": ",".join(sorted(reviewers)),
    }
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        for key, value in context.items():
            delimiter = f"GHDELIM_{uuid.uuid4().hex}"
            output.write(f"{key}<<{delimiter}\n{value}\n{delimiter}\n")


if __name__ == "__main__":
    main()
