import { mergeFeeds, parseFeed } from "../news";

// Shaped like the real feeds, with made-up stories.
const WST = `<rss><channel>
<item>
  <title><![CDATA[Example Open Day One]]></title>
  <link>https://www.wst.tv/news/2026/september/21/example-open-day-one/</link>
  <pubDate>Mon, 21 Sep 2026 15:20:37 GMT</pubDate>
  <description><![CDATA[<div class="gc-FeaturedImage"><img src="https://images.example/fit-in/1800x1800/a.jpg" alt="a"/></div><div><p>Player A won 4&#8211;0 against Player B &amp; moved on.</p><p>Second paragraph.</p></div>]]></description>
</item>
<item><title>No link</title><pubDate>Mon, 21 Sep 2026 15:20:37 GMT</pubDate></item>
</channel></rss>`;

const BBC = `<rss><channel>
<item>
  <title><![CDATA[Someone wins the Example Open]]></title>
  <description><![CDATA[A short line about the final.]]></description>
  <link>https://www.bbc.co.uk/sport/snooker/articles/abc?at_medium=RSS&amp;at_campaign=rss</link>
  <pubDate>Sun, 20 Sep 2026 22:07:24 GMT</pubDate>
  <media:thumbnail width="240" height="135" url="https://ichef.example/ace/standard/240/x.jpg"/>
</item>
<item>
  <title><![CDATA[Example Open Day One]]></title>
  <link>https://www.bbc.co.uk/sport/snooker/articles/dup</link>
  <pubDate>Mon, 21 Sep 2026 10:00:00 GMT</pubDate>
</item>
</channel></rss>`;

describe("tour news", () => {
  it("reads the WST feed: first paragraph, picture, decoded text", () => {
    const [item, ...rest] = parseFeed(WST, "wst");
    expect(rest).toHaveLength(0);
    expect(item.title).toBe("Example Open Day One");
    expect(item.summary).toBe("Player A won 4–0 against Player B & moved on.");
    expect(item.image).toBe("https://images.example/fit-in/1800x1800/a.jpg");
    expect(item.publishedAt).toBe("2026-09-21T15:20:37.000Z");
  });

  it("reads the BBC feed with the larger thumbnail", () => {
    const [item] = parseFeed(BBC, "bbc");
    expect(item.link).toBe("https://www.bbc.co.uk/sport/snooker/articles/abc?at_medium=RSS&at_campaign=rss");
    expect(item.id).toBe("bbc:https://www.bbc.co.uk/sport/snooker/articles/abc");
    expect(item.image).toBe("https://ichef.example/ace/standard/480/x.jpg");
    expect(item.summary).toBe("A short line about the final.");
  });

  it("merges newest first without the same headline twice", () => {
    const merged = mergeFeeds([parseFeed(WST, "wst"), parseFeed(BBC, "bbc")]);
    expect(merged.map((item) => item.title)).toEqual(["Example Open Day One", "Someone wins the Example Open"]);
    expect(merged[0].source).toBe("wst");
  });
});
