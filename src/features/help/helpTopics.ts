/**
 * The "?" help for each part of the app: what it's for, how to use it, and a few tips. All in one
 * place so the voice stays the same and it's easy to keep up to date as features change. A screen
 * finds its topic by route name (ROUTE_TOPICS); screens that share a feature share a topic.
 */

export type HelpTopic = {
  title: string;
  /** One or two sentences: what this is for. */
  purpose: string;
  /** How to use it, in order. */
  steps: string[];
  tips?: string[];
  /** Which welcome tour "Replay the tour" opens. */
  audience: "player" | "coach";
};

export const HELP_TOPICS = {
  home: {
    title: "Home",
    audience: "player",
    purpose: "Your snooker at a glance: what to practise next, your streak and form, and what's on the pro tour.",
    steps: [
      "Tap Start session to begin your next practice session, or Plan to see your week.",
      "Streak, days this week and form show how you're getting on. Tap any of them for more.",
      "Swipe the pages below for this week, what to practise next, what you did lately, and pro tour news.",
      "The green scores strip shows a live pro match, or the next tournament. Tap it for Live & results.",
    ],
    tips: ["Practise a little on most days to keep your streak going.", "Everything here updates as soon as you log a match or a routine."],
  },
  practiceHome: {
    title: "Practice",
    audience: "player",
    purpose: "Where your practice lives: routines to work on each part of your game, sessions to play them in, and your weekly plan.",
    steps: [
      "Pick a category to find routines, or build your own.",
      "Open a routine to see how to set it up, then record your score when you've played it.",
      "Sessions group routines into one practice, and your plan sets how often you aim to practise.",
    ],
    tips: ["Your best on every routine is kept, so you can see yourself improve."],
  },
  practice: {
    title: "Practice sessions",
    audience: "player",
    purpose: "A session is a set of routines you play through in one go, so your practice has a plan and a score.",
    steps: [
      "Pick a saved session, or build one from routines you choose.",
      "Start it, and play each routine in turn. Record your score as you finish each one.",
      "When you finish, the session is saved to your practice history and counts towards your streak.",
    ],
    tips: ["Save sessions you play often, so they're one tap from Home.", "Short and regular beats long and rare."],
  },
  practicePlan: {
    title: "Practice plan",
    audience: "player",
    purpose: "Decide how many days a week you want to practise, and set goals for the routines that matter to you.",
    steps: [
      "Choose the days you aim to practise each week.",
      "Add a goal: pick a routine, the score you want to reach, and when by.",
      "Your progress towards each goal updates whenever you record a score on that routine.",
    ],
    tips: ["Pick goals a little beyond your best, not miles beyond it."],
  },
  routines: {
    title: "Routines",
    audience: "player",
    purpose: "Drills with a score, so you can see whether you're getting better at each part of your game.",
    steps: [
      "Browse routines by category, or search for one.",
      "Open a routine to see how to set it up and what counts as the score.",
      "Play it, then record your score. Your best and your progress over time are kept on the routine.",
      "Each routine has a leaderboard, so you can see how your best compares.",
    ],
    tips: ["Use AR set-up on a routine to see where each ball goes on your real table."],
  },
  routineBuilder: {
    title: "Build a routine",
    audience: "player",
    purpose: "Make your own drill: place the balls on the table, name it and set a score to aim for.",
    steps: [
      "Drag balls onto the table. Pinch to zoom in and place them precisely.",
      "Undo any change one step at a time.",
      "Add a name, what the routine is, and a target score, then save it.",
      "Share it from the routine if you want others to try it.",
    ],
  },
  recordScore: {
    title: "Record a score",
    audience: "player",
    purpose: "Save how you did on a routine, so your best and your progress keep up to date.",
    steps: ["Enter your score for this go.", "Add a note if something's worth remembering.", "Save. Your best and any goals on this routine update straight away."],
  },
  routineAR: {
    title: "AR set-up",
    audience: "player",
    purpose: "Set a routine up on your real table. Each ball appears as a ghost where it should go.",
    steps: [
      "Point your phone at the table and follow the steps to calibrate.",
      "Place the real balls where the ghosts appear.",
      "Recalibrate if the ghosts drift away from the table.",
    ],
    tips: ["Good, even light helps the phone find the table."],
  },
  leaderboards: {
    title: "Leaderboards",
    audience: "player",
    purpose: "See how you compare: levels, high breaks, centuries and wins, plus a board for every routine.",
    steps: ["Switch between everyone and just your friends.", "Open a routine's board to see every player's best on it."],
  },
  matches: {
    title: "Matches",
    audience: "player",
    purpose: "Every match you've played, your record against each opponent, and your tournaments.",
    steps: [
      "Tap New match to start one. A regular opponent fills in the rest from last time.",
      "Open a match for the frames, the breaks and the statistics.",
      "Opponents shows your head-to-head record with everyone you've played.",
    ],
    tips: ["Pick a friend as your opponent and, once they confirm it, the match counts for both of you."],
  },
  newMatch: {
    title: "New match",
    audience: "player",
    purpose: "Set up a match in a few taps, then score it frame by frame.",
    steps: [
      "Choose your opponent first. Someone you've played before fills in the venue and format.",
      "Pick a friend to link the match, so it counts for both of you once they confirm.",
      "Set the number of frames, then start scoring.",
    ],
  },
  liveScoring: {
    title: "Live scoring",
    audience: "player",
    purpose: "Score a frame ball by ball. Snookered keeps the score, the break and the points left on the table.",
    steps: [
      "Tap the ball that was potted. The player at the table gets the points.",
      "Use Foul for a foul (choose the value), Safety after a safety shot, and End Break when a visit ends.",
      "Switch changes who's at the table, and Undo takes back the last action.",
      "Tap End frame when it's over. Re-rack replays the frame, and Abandon frame doesn't count it.",
    ],
    tips: [
      "Scores save on your phone and sync later, so a bad signal never stops a match.",
      "Use Scan snooker before a snooker, so you can put the balls back after a foul and a miss.",
    ],
  },
  scanSnooker: {
    title: "Scan a Snooker",
    audience: "player",
    purpose: "Scan the table before a snooker, so after a foul and a miss every ball can go back exactly where it was.",
    steps: [
      "Before the snooker is played, scan the table so the ball positions are saved.",
      "If it's a foul and a miss, open the scan again.",
      "Follow the ghost balls shown in AR to put each ball back.",
    ],
    tips: ["Works best with good light and the whole table in view.", "Recalibrate if the ghosts don't line up with the table."],
  },
  recordSnooker: {
    title: "Record a Snooker",
    audience: "player",
    purpose: "Walk once round the table and the balls are found for you, instead of scanning each one by hand.",
    steps: [
      "Aim at two spots to line the table up, the same as Scan Snooker.",
      "Walk slowly all the way round with the phone tilted down at the balls.",
      "Check what was found on the diagram, fix anything that's wrong, then save.",
    ],
    tips: ["This is being tested, and saves separately from Scan Snooker.", "A marker lands on each ball once it has been seen from more than one side."],
  },
  tournaments: {
    title: "Tournaments",
    audience: "player",
    purpose: "Run a knockout or a league for your club or friends, with the draw, fixtures and results kept for you.",
    steps: [
      "Create a tournament: choose knockout or league, add the players and the format.",
      "Snookered makes the draw and the fixtures.",
      "Score each match. Results and the next round update automatically.",
    ],
  },
  stats: {
    title: "Stats",
    audience: "player",
    purpose: "The numbers that show whether you're improving: form, practice and high breaks.",
    steps: [
      "This week and the last four weeks show how much you've practised.",
      "Form shows your recent results. A win rate appears once you've played a few matches.",
      "High breaks update as you score.",
    ],
  },
  aiCoach: {
    title: "AI Coach",
    audience: "player",
    purpose: "Film yourself at the table and get feedback on your technique: what's working, the one thing to fix first, and routines that train it.",
    steps: [
      "Choose what you want looked at, such as your cue action or stance.",
      "Film or pick a clip of up to 20 seconds. Trim it to the shots that matter.",
      "Upload it. Your report appears when the analysis is done.",
      "Your past reports are kept, so you can see whether a fix has stuck.",
    ],
    tips: ["Film side-on at table height, with your whole body and the cue in shot.", "Good light makes for better feedback."],
  },
  community: {
    title: "Community",
    audience: "player",
    purpose: "Your friends, chats, groups and leaderboards, plus pro tour scores and news.",
    steps: [
      "Find players by name or @handle and send a friend request.",
      "Requests shows people waiting for your answer.",
      "Chats, Groups, Routines and Boards are along the top.",
      "Tap a friend to see their profile and record against you.",
    ],
    tips: ["Your privacy settings (the cog) control who can find you, see your stats and message you."],
  },
  chats: {
    title: "Chats",
    audience: "player",
    purpose: "Message friends, other players and your groups.",
    steps: [
      "Start a chat with a friend, or search for anyone.",
      "Someone who isn't your friend gets your first message as a request.",
      "Share a routine or a match result straight into a chat.",
    ],
  },
  groups: {
    title: "Groups",
    audience: "player",
    purpose: "A group for your club or league, with its own chat, a feed of results, leaderboards and pinned routines.",
    steps: [
      "Join a public group, accept an invite, or create your own.",
      "The feed shows what members have done. Boards show the group's leaderboards.",
      "Owners and admins choose who can join, post and invite.",
    ],
  },
  liveMatch: {
    title: "Following a match",
    audience: "player",
    purpose: "Watch a friend's match as it's scored: the frames, the break and who's at the table.",
    steps: ["Scores update the moment the scorer taps a ball.", "Scroll down for the high breaks and every frame so far."],
  },
  proTour: {
    title: "Pro Tour",
    audience: "player",
    purpose: "News, live scores, fixtures, results and rankings from the professional tour, in your own time zone.",
    steps: [
      "News has the latest from the World Snooker Tour and BBC Sport.",
      "Live & results shows matches on now, then tournaments coming up and this season's results.",
      "Tap a tournament for its draw, fixtures and prize money.",
      "Rankings lists the money rankings. Tap a player for their profile.",
    ],
    tips: ["Follow players to pin their matches to the top and get a notification when they're on.", "Times marked approx. are follow-on matches, so they start when the match before finishes."],
  },
  proTourTournament: {
    title: "Tournament",
    audience: "player",
    purpose: "One tournament: where and when, the prize fund, and its draw round by round.",
    steps: [
      "Pick a round to see its fixtures by day and session, in your own time.",
      "Switch to Bracket to see the draw as a tree, from any round to the final.",
      "Tap Prize fund for the money at each round.",
      "Tap a match for frame scores and the head-to-head.",
    ],
    tips: ["“Winner of X v Y” shows who could fill a slot that's still to be decided."],
  },
  proTourMatch: {
    title: "Match",
    audience: "player",
    purpose: "Everything about one pro match: the score, where to watch, frame by frame, the head-to-head and form.",
    steps: [
      "Watch opens the stream, where the match is being shown.",
      "Frame by frame lists every frame's score and the big breaks.",
      "Head to head shows their record against each other. Form shows this season.",
    ],
  },
  proTourPlayer: {
    title: "Player",
    audience: "player",
    purpose: "A professional player: their ranking, titles, story and this season's matches.",
    steps: [
      "Tap Follow to pin their matches and get a notification when they start and finish.",
      "This season shows their won-lost record and recent form.",
      "Coming up and Recent results list their matches. Tap one for the detail.",
    ],
  },
  findCoach: {
    title: "Find a coach",
    audience: "player",
    purpose: "Find a coach near you, see their qualifications and reviews, and book a session.",
    steps: [
      "Search by name or where they coach.",
      "Open a coach to see their qualifications, location and reviews.",
      "Pick an open time to send a booking request. You'll be told when they accept.",
    ],
    tips: ["Every coach is checked by hand before they can take bookings."],
  },
  coaching: {
    title: "Your coaching",
    audience: "player",
    purpose: "Everything with your coach in one place: your next session, homework, booking again, and what you covered each time.",
    steps: [
      "Your next session is at the top. Message your coach or add it to your calendar.",
      "Set by your coach lists your homework. Tap Start to play it, and your scores count automatically.",
      "Book again shows your coach's next free times. Tap one to send a request.",
      "Session history shows what you worked on each time. Tap a session for your coach's notes.",
    ],
    tips: ["After a session, rate your coach. It helps other players find good coaches."],
  },
  coachingSession: {
    title: "Session",
    audience: "player",
    purpose: "One session with your coach: what you worked on, their notes for you, the routines you covered and your homework.",
    steps: ["Read your coach's notes and the areas you focused on.", "Tap a routine to practise it again.", "Rate the session once it's over."],
    tips: ["Your coach's private notes are never shown here, only what they've shared with you."],
  },
  coachGroup: {
    title: "Coach group",
    audience: "player",
    purpose: "Drills, videos and documents your coach posts for everyone in the group.",
    steps: ["New posts appear at the top.", "Tap a video or PDF to open it."],
  },
  achievements: {
    title: "Achievements",
    audience: "player",
    purpose: "Badges for the things that matter, from centuries to streaks. Each one earns XP towards your level.",
    steps: ["Tap a badge to see what it's for and how close you are.", "XP from badges, matches and practice raises your level."],
  },
  // ------------------------------------------------------------------ coach view
  coachAgenda: {
    title: "Agenda",
    audience: "coach",
    purpose: "Your day as a coach: requests waiting for an answer, then today's sessions and what's coming up.",
    steps: [
      "Accept or decline booking requests at the top.",
      "Tap a session to open it: keep time, log routines, write notes and set homework.",
      "Add a session to your phone's calendar from its options.",
    ],
  },
  coachDashboard: {
    title: "Coach dashboard",
    audience: "coach",
    purpose: "The bigger picture of your coaching: trends this week and month, your regulars, and recent sessions.",
    steps: ["Swipe the pages for trends, top clients and recent sessions.", "Anything waiting on you shows as a banner at the top."],
  },
  coachCalendar: {
    title: "Calendar",
    audience: "coach",
    purpose: "When you're free and when you're booked, on a month view.",
    steps: [
      "Tap a day to see its slots and bookings.",
      "Add open slots players can book. Repeat them weekly to save time.",
      "Book a client in yourself, even someone without a Snookered account.",
    ],
    tips: ["Open slots in the past are cleared away automatically."],
  },
  coachClients: {
    title: "Clients",
    audience: "coach",
    purpose: "Everyone you've coached, with their sessions, homework and progress.",
    steps: [
      "Open a client to see every session with them.",
      "Set homework: pick a routine, a target and how often. You'll see their best score and how often they've played it.",
      "Message a client from their page.",
    ],
  },
  coachSession: {
    title: "Session",
    audience: "coach",
    purpose: "Run a session as it happens, and share the important parts with your client afterwards.",
    steps: [
      "The countdown keeps time.",
      "Add the routines you covered, with your client's score. They can see these.",
      "Under Shared with your client, tick what you worked on and write notes for them.",
      "Set homework to practise before next time. Private notes are only ever seen by you.",
    ],
    tips: ["Clients without a Snookered account can't see anything, so everything stays private."],
  },
  coachGroups: {
    title: "Groups",
    audience: "coach",
    purpose: "Post drills, videos and PDFs to groups of your clients, so one post reaches everyone.",
    steps: ["Create a group and choose which clients are in it.", "Post a video, an image or a PDF with a caption.", "Members see it in the group on their Coaching tab."],
  },
  coachChats: {
    title: "Chats",
    audience: "coach",
    purpose: "Messages with your clients.",
    steps: ["Open a chat to reply.", "Start a new chat with any client from their page."],
  },
  coachSettings: {
    title: "Coach settings",
    audience: "coach",
    purpose: "What players see on your coach listing.",
    steps: ["Add your qualifications and WPBSA accreditation.", "Say where you coach, so players nearby can find you."],
  },
} satisfies Record<string, HelpTopic>;

export type HelpTopicId = keyof typeof HELP_TOPICS;

/** Which topic each screen shows. A route missing here shows no "?". */
export const ROUTE_TOPICS: Partial<Record<string, HelpTopicId>> = {
  DashboardHome: "home",
  SessionsHome: "practice",
  SessionSetup: "practice",
  GuidedSessionBuilder: "practice",
  ActiveSession: "practice",
  SessionTemplateDetail: "practice",
  PracticePlan: "practicePlan",
  NewGoal: "practicePlan",
  RoutineCategories: "practiceHome",
  RoutinesList: "routines",
  RoutineDetail: "routines",
  RoutineLibrary: "routines",
  SharedRoutine: "routines",
  CustomRoutine: "routines",
  CustomRoutineBuilder: "routineBuilder",
  RecordRoutineScore: "recordScore",
  RoutineAR: "routineAR",
  Leaderboards: "leaderboards",
  RoutineBoards: "leaderboards",
  RoutineLeaderboard: "leaderboards",
  MatchesList: "matches",
  MatchDetail: "matches",
  OpponentMatches: "matches",
  MatchComplete: "matches",
  NewMatch: "newMatch",
  LiveFrameScoring: "liveScoring",
  ScanSnooker: "scanSnooker",
  RecordSnooker: "recordSnooker",
  NewTournament: "tournaments",
  TournamentDetail: "tournaments",
  Stats: "stats",
  // The Stats tab's own root screen is called "Dashboard".
  Dashboard: "stats",
  AIDashboard: "aiCoach",
  VideoUpload: "aiCoach",
  AnalysisHistory: "aiCoach",
  AnalysisDetail: "aiCoach",
  CommunityHome: "community",
  PlayerProfile: "community",
  Chats: "chats",
  Chat: "chats",
  NewChat: "chats",
  Groups: "groups",
  Group: "groups",
  GroupForm: "groups",
  LiveMatch: "liveMatch",
  TourNews: "proTour",
  ProTourTournament: "proTourTournament",
  ProTourMatch: "proTourMatch",
  ProTourPlayer: "proTourPlayer",
  FindCoach: "findCoach",
  CoachProfile: "findCoach",
  BookCoach: "findCoach",
  CoachingHome: "coaching",
  CoachingSession: "coachingSession",
  CoachGroup: "coachGroup",
  Achievements: "achievements",
  // coach view
  CoachToday: "coachAgenda",
  CoachDashboard: "coachDashboard",
  CoachCalendar: "coachCalendar",
  CoachClients: "coachClients",
  ClientsList: "coachClients",
  ClientDetail: "coachClients",
  LiveSession: "coachSession",
  CoachGroups: "coachGroups",
  GroupsList: "coachGroups",
  CoachGroupForm: "coachGroups",
  CoachGroupPostForm: "coachGroups",
  CoachChats: "coachChats",
  ChatsList: "coachChats",
  CoachSettings: "coachSettings",
};
