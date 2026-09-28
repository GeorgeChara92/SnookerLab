import { linkify, linkUrlFor } from "../linkify";

describe("linkifying a chat message", () => {
  it("leaves plain text with no links alone", () => {
    expect(linkify("See you Tuesday at 7")).toEqual([{ text: "See you Tuesday at 7", kind: "text" }]);
  });

  it("finds an email in the middle of a sentence", () => {
    const segments = linkify("Send it to coach@example.com when you get a chance");
    expect(segments.map((s) => s.kind)).toEqual(["text", "email", "text"]);
    expect(segments[1].text).toBe("coach@example.com");
    expect(linkUrlFor(segments[1])).toBe("mailto:coach@example.com");
  });

  it("finds a UK postcode and links it to a maps search", () => {
    const segments = linkify("The club is at SW1A 1AA, see you there");
    expect(segments.map((s) => s.kind)).toEqual(["text", "postcode", "text"]);
    expect(segments[1].text).toBe("SW1A 1AA");
    expect(linkUrlFor(segments[1])).toBe("https://www.google.com/maps/search/?api=1&query=SW1A%201AA");
  });

  it("finds a phone number and strips formatting for the tel: link", () => {
    const segments = linkify("Call me on 07911 123456 tonight");
    expect(segments.map((s) => s.kind)).toEqual(["text", "phone", "text"]);
    expect(linkUrlFor(segments[1])).toBe("tel:07911123456");
  });

  it("does not double-count a phone-shaped run of digits inside an email", () => {
    const segments = linkify("try 12345678@example.com");
    expect(segments.map((s) => s.kind)).toEqual(["text", "email"]);
  });
});
