import { describe, expect, it } from "vitest";
import { parseSseEventBlock } from "./api";

describe("parseSseEventBlock", () => {
  it("defaults to the message event when no event field is present", () => {
    const { event, data } = parseSseEventBlock("data: {\"cached\":false}\n\n");
    expect(event).toBe("message");
    expect(JSON.parse(data).cached).toBe(false);
  });

  it("parses a named event with its payload", () => {
    const block = "event: progress\ndata: {\"completedTrials\":10,\"totalTrials\":100}";
    expect(parseSseEventBlock(block)).toEqual({
      event: "progress",
      data: '{"completedTrials":10,"totalTrials":100}',
    });
  });

  it("concatenates repeated data lines", () => {
    const block = "event: result\ndata: {\"runId\":\"abc\",\ndata: \"cached\":true}";
    const { event, data } = parseSseEventBlock(block);
    expect(event).toBe("result");
    expect(data).toBe('{"runId":"abc","cached":true}');
  });

  it("ignores a leading colon comment line", () => {
    const { data } = parseSseEventBlock(": keep-alive\ndata: hello");
    expect(data).toBe("hello");
  });
});
