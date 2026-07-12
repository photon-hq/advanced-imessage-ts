import { describe, expect, it } from "bun:test";
import { TypedEventStream } from "../src/streaming/event-stream.ts";

async function toArray<T>(stream: TypedEventStream<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const event of stream) {
    out.push(event);
  }
  return out;
}

async function* events<T>(values: readonly T[]): AsyncGenerator<T> {
  yield* values;
}

describe("TypedEventStream", () => {
  it("supports for-await consumption", async () => {
    const stream = new TypedEventStream(events([1, 2, 3]));

    expect(await toArray(stream)).toEqual([1, 2, 3]);
  });

  it("allows only one consumer per stream", async () => {
    const stream = new TypedEventStream(events([1, 2, 3]));

    stream[Symbol.asyncIterator]();

    expect(() => stream[Symbol.asyncIterator]()).toThrow(
      "TypedEventStream already has a consumer."
    );
  });

  it("filters and maps through derived streams", async () => {
    const stream = new TypedEventStream(events([1, 2, 3, 4]))
      .filter((value) => value % 2 === 0)
      .map((value) => value * 10);

    expect(await toArray(stream)).toEqual([20, 40]);
  });

  it("take(count) yields the requested prefix and closes the parent", async () => {
    let returned = false;

    async function* source(): AsyncGenerator<number> {
      try {
        yield 1;
        yield 2;
        yield 3;
      } finally {
        returned = true;
      }
    }

    const stream = new TypedEventStream(source()).take(2);

    expect(await toArray(stream)).toEqual([1, 2]);
    expect(returned).toBe(true);
  });

  it("take(0) does not consume the parent stream", async () => {
    let pulled = false;

    async function* source(): AsyncGenerator<number> {
      pulled = true;
      yield 1;
    }

    const parent = new TypedEventStream(source());

    expect(await toArray(parent.take(0))).toEqual([]);
    expect(pulled).toBe(false);
    expect(await toArray(parent)).toEqual([1]);
  });

  it("close() interrupts a pending iterator", async () => {
    async function* source(): AsyncGenerator<number> {
      await new Promise<never>(() => {
        // Intentionally never resolves.
      });
      yield 1;
    }

    const stream = new TypedEventStream(source());

    const iterator = stream[Symbol.asyncIterator]();
    const next = iterator.next();

    await stream.close();

    expect(await next).toEqual({ done: true, value: undefined });
  });

  it("close() absorbs a later source rejection caused by teardown", async () => {
    let rejectSource: ((error: Error) => void) | undefined;

    async function* source(): AsyncGenerator<number> {
      await new Promise<never>((_resolve, reject) => {
        rejectSource = reject;
      });
      yield 1;
    }

    const stream = new TypedEventStream(source());
    const iterator = stream[Symbol.asyncIterator]();
    const next = iterator.next();

    await stream.close();
    rejectSource?.(new Error("teardown"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(await next).toEqual({ done: true, value: undefined });
  });

  it("on() delivers events in order and applies async back-pressure", async () => {
    const delivered: number[] = [];
    const stream = new TypedEventStream(events([1, 2, 3]));

    stream.on(async (event) => {
      delivered.push(event);
      await Promise.resolve();
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(delivered).toEqual([1, 2, 3]);
  });

  it("on() routes callback errors to the error handler", async () => {
    const error = new Error("callback failed");
    const errors: unknown[] = [];
    const stream = new TypedEventStream(events([1]));

    stream.on(
      () => {
        throw error;
      },
      (caught) => {
        errors.push(caught);
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(errors).toEqual([error]);
  });

  it("on() unsubscribe closes the stream", async () => {
    let returned = false;
    let releaseNext: (() => void) | undefined;

    async function* source(): AsyncGenerator<number> {
      try {
        yield 1;
        await new Promise<void>((resolve) => {
          releaseNext = resolve;
        });
        yield 2;
      } finally {
        returned = true;
      }
    }

    const delivered: number[] = [];
    const stream = new TypedEventStream(source());
    const unsubscribe = stream.on((event) => {
      delivered.push(event);
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    unsubscribe();
    releaseNext?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(delivered).toEqual([1]);
    expect(returned).toBe(true);
  });
});
