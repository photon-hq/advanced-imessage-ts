import importlib.util
import json
import os
import pathlib
import subprocess
import tempfile
import unittest
from contextlib import chdir
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "release_docs", pathlib.Path(__file__).resolve().parents[2] / "scripts/release_docs.py"
)
release_docs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_docs)


class ReleaseDocsTests(unittest.TestCase):
    def test_selects_nearest_lower_stable_version_not_creation_order(self):
        tags = [
            "v2.10.0", "v2.9.0", "advanced-imessage-ts-staging-2.11.0-staging.123.1",
            "v2.8.100", "v2.10.1-rc.1", "v2.11.0", "v3.0.0",
        ]
        self.assertEqual(release_docs.previous_stable_tag(tags, "v2.11.0"), "v2.10.0")

    def test_rejects_nonstable_release_tags(self):
        with self.assertRaises(ValueError):
            release_docs.previous_stable_tag([], "v2.4.1-rc.1")

    def test_diffs_previous_release_and_caps_output(self):
        with tempfile.TemporaryDirectory() as directory:
            def git(*args, data=None):
                return subprocess.check_output(
                    ["git", *args], cwd=directory, input=data, text=True
                ).strip()

            git("init", "--quiet")
            blob = git("hash-object", "-w", "--stdin", data="first release\n")
            tree = git("mktree", data=f"100644 blob {blob}\tfile.txt\n")
            git("update-ref", "refs/tags/v0.1.0", tree)
            blob = git("hash-object", "-w", "--stdin", data="x" * 120_000 + "\n")
            tree = git("mktree", data=f"100644 blob {blob}\tfile.txt\n")
            git("update-ref", "refs/tags/v0.2.0", tree)
            diff = release_docs.release_diff("v0.2.0", "v0.1.0", directory)
            self.assertIn("-first release", diff)
            self.assertTrue(diff.endswith(release_docs.TRUNCATED))
            self.assertEqual(len(diff), release_docs.DIFF_LIMIT + len(release_docs.TRUNCATED))

    def test_main_writes_release_context_and_only_active_codeowners(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)

            def git(*args, data=None):
                return subprocess.check_output(
                    ["git", *args], cwd=root, input=data, text=True
                ).strip()

            git("init", "--quiet")
            (root / ".github").mkdir()
            (root / ".github/CODEOWNERS").write_text(
                "# Former owner: @alice\n* @zed-user @org/sdk-team @current-owner\n"
                "packages/@alice/** @path-owner @zed-user # Former owner: @bob\n",
                encoding="utf-8",
            )
            (root / "README.md").write_text("First release\n", encoding="utf-8")
            git("add", "README.md", ".github/CODEOWNERS")
            tree = git("write-tree")
            commit = git(
                "hash-object", "-w", "-t", "commit", "--stdin",
                data=(
                    f"tree {tree}\n"
                    "author Release fixture <fixture@example.invalid> 0 +0000\n"
                    "committer Release fixture <fixture@example.invalid> 0 +0000\n"
                    "\nRelease context fixture\n"
                ),
            )
            git("update-ref", "refs/tags/v0.1.0", commit)
            release = {
                "tag_name": "v0.1.0", "prerelease": False, "draft": False,
                "body": "Release notes\nwith two lines",
            }
            (root / "bin").mkdir()
            gh = root / "bin/gh"
            gh.write_text(
                "#!/usr/bin/env python3\nimport sys\n"
                "assert sys.argv[1:] == "
                "['api', 'repos/photon-hq/fixture/releases/tags/v0.1.0']\n"
                f"print({json.dumps(release)!r})\n",
                encoding="utf-8",
            )
            gh.chmod(0o755)
            output = root / "github-output"
            with chdir(root), patch.dict(os.environ, {
                "RELEASE_TAG": "v0.1.0",
                "GITHUB_REPOSITORY": "photon-hq/fixture",
                "GITHUB_OUTPUT": str(output),
                "PATH": f"{root / 'bin'}{os.pathsep}{os.environ['PATH']}",
            }):
                release_docs.main()

            context = output.read_text(encoding="utf-8")
            self.assertRegex(context, r"(?m)^reviewers<<[^\n]+\ncurrent-owner,org/sdk-team,path-owner,zed-user\n")
            self.assertIn("new file mode 100644", context)
            self.assertIn("+First release", context)


if __name__ == "__main__":
    unittest.main()
