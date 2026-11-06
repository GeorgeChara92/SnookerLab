import { RULE_GROUPS, RULE_TOPICS, getRuleTopic } from "../rules";
import { BALL_RADIUS, TABLE } from "../../scanSnooker/table";

describe("rules of snooker", () => {
  it("lists every topic exactly once", () => {
    const listed = RULE_GROUPS.flatMap((group) => group.topics);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(RULE_TOPICS.map((topic) => topic.id).sort());
  });

  it("only links to topics that exist, never to itself", () => {
    for (const topic of RULE_TOPICS) {
      for (const id of topic.related) {
        expect(getRuleTopic(id)).toBeDefined();
        expect(id).not.toBe(topic.id);
      }
    }
  });

  it("gives every topic a short answer, detail and questions", () => {
    for (const topic of RULE_TOPICS) {
      expect(topic.short.length).toBeGreaterThan(20);
      expect(topic.sections.length).toBeGreaterThan(0);
      for (const section of topic.sections) expect(section.body || section.points?.length).toBeTruthy();
      expect(topic.questions.length).toBeGreaterThan(0);
    }
  });

  it("draws diagrams with every ball on the bed and none overlapping", () => {
    for (const topic of RULE_TOPICS) {
      const balls = topic.diagram?.balls ?? [];
      expect(balls.filter((ball) => ball.colour === "cue").length).toBeLessThanOrEqual(1);
      for (const ball of balls) {
        expect(ball.x).toBeGreaterThanOrEqual(BALL_RADIUS);
        expect(ball.x).toBeLessThanOrEqual(TABLE.width - BALL_RADIUS);
        expect(ball.y).toBeGreaterThanOrEqual(BALL_RADIUS);
        expect(ball.y).toBeLessThanOrEqual(TABLE.length - BALL_RADIUS);
      }
      balls.forEach((a, i) =>
        balls.slice(i + 1).forEach((b) => {
          // Touching is allowed (that's the touching-ball diagram); overlapping isn't.
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(TABLE.ball - 0.01);
        })
      );
    }
  });
});
