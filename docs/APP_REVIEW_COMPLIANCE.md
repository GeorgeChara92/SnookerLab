# App Review: where Snookered stands

Checked against the App Review Guidelines on 23 September 2026, before the first build.
Guideline numbers are Apple's.

## In the app already

| Guideline                         | What it asks for                                   | Where it is                                                             |
| --------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| 1.2 User-generated content        | Filter objectionable material                       | `features/community/wordFilter.ts`, matched by `contains_blocked_word` in the database. Applied to handles, bios, group names, messages and, now, routine names and descriptions. |
| 1.2                               | Report offensive content                            | Report on messages, groups, routines and players; reviewed in `AdminReportsScreen`. |
| 1.2                               | Block abusive users                                 | Block and unblock in Community settings; blocked players cannot message you. |
| 1.2                               | Published contact information                       | support@snookeredapp.com, in the app and on the website.                 |
| 3.1.2, 4.9 Subscriptions          | Price, period, renewal terms, how to cancel         | Plans screen shows price and period per plan, "renews monthly until cancelled", Restore purchases, Terms and Privacy links. |
| 5.1.1(i) Privacy policy           | A link inside the app                               | Settings, and on the sign-up screen next to Terms.                       |
| 5.1.1(ii) Purpose strings         | Say what the data is used for                       | Camera, photo library and microphone strings in `app.json`.              |
| 5.1.1(v) Account deletion         | Delete the account from inside the app              | Profile → Settings → Delete Account, which calls the `delete-account` function: storage files removed, then the auth user deleted (rows cascade). |
| 5.1.2(i) Third-party AI           | Disclose and get permission before sharing          | The first clip asks before anything is sent, and the notice by the send button names Google's Gemini API every time. |
| 2.1 Completeness                  | Nothing half-built on show                          | AR falls back to the table diagram when the native module is missing, so a build without it still works. |

## Fixed in this pass

- **Microphone permission string.** The app records clips with `launchCameraAsync`, which
  captures sound, but the microphone string was switched off. iOS terminates an app that
  records without one, so this would have failed review or crashed. Now set.
- **Consent before clips leave the phone.** Coach uploads now explain that the clip goes to
  Google's Gemini API and ask once before the first upload (5.1.2(i)).
- **Routine names and descriptions are filtered.** They can be shared publicly, so they now
  go through the same word filter as chat (1.2).

## Still to do outside the code

These are App Store Connect or account jobs, not app changes.

1. **Privacy nutrition labels.** Declare: contact info (email), user content (clips, messages,
   routines), identifiers (account id), usage data if any analytics are added. Say clips are
   sent to a third party for processing.
2. **Age rating.** Answer the questionnaire honestly: the app has unrestricted chat and
   user-generated content, which pushes the rating up. Expect 12+ or higher.
3. **Demo account for review.** Give them a working account with data, and say in the notes
   that the account is needed because scores, practice and community all sync.
4. **Review notes.** Mention: Coach analysis is AI-generated guidance, not instruction from a
   qualified coach; AR features ship disabled until tested on a device; the news feed links out
   to WST and BBC Sport and stores no article content.
5. **Export compliance.** `ITSAppUsesNonExemptEncryption` is already false in `app.json`.

## Worth knowing

- **Sign in with Apple is not required.** It only applies if you add a third-party login such
  as Google or Facebook. Email and password alone does not trigger it.
- **Account-only access is acceptable** here because scoring, practice and community all sync
  to an account, but expect a reviewer to ask. The review notes should say so.
- **Coach wording.** Keep it as guidance. Anything that reads as a promise to improve someone's
  game, or as health or injury advice, invites trouble under 1.4.1.
