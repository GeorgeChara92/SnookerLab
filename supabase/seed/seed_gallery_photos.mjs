// Uploads a few placeholder photos to the demo coach's gallery, for the coach profile screenshot -
// something SQL alone can't do, since coach_gallery_photos.path has to point at a real file that
// actually exists in the coach-gallery-photos storage bucket, not just a row in a table.
//
// Run locally with your own Supabase credentials, already in .env at the project root:
//
//     node supabase/seed/seed_gallery_photos.mjs
//
// Safe to run more than once - it clears this coach's existing gallery first. Uses the service
// role key, so it bypasses the app's own 6-photo trigger and upload flow entirely; that's fine
// for seeding, but never ship this key or this script's approach anywhere client-facing.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const env = Object.fromEntries(
  readFileSync(path.join(ROOT, ".env"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env");
}

// Either handle - the real one, or the one it's renamed to for screenshots (see make_demo_seed.py).
const COACH_HANDLES = ["georgechara", "dannyhale"];
const BUCKET = "coach-gallery-photos";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id, handle")
  .in("handle", COACH_HANDLES)
  .maybeSingle();
if (profileError) throw profileError;
if (!profile) throw new Error(`No profile with handle in ${JSON.stringify(COACH_HANDLES)}. Run demo_account.sql first.`);

console.log(`Seeding gallery for ${profile.handle} (${profile.id})`);

// Clear whatever is there already, so this is safe to run again.
const { data: existing } = await supabase.storage.from(BUCKET).list(profile.id);
if (existing?.length) {
  await supabase.storage.from(BUCKET).remove(existing.map((file) => `${profile.id}/${file.name}`));
}
await supabase.from("coach_gallery_photos").delete().eq("coach_id", profile.id);

// A hand-picked list rather than a live search - a free-text or category search on Commons turns
// up plenty of unrelated matches (rooms, portraits, anything vaguely "billiards"-tagged). Each of
// these was checked by hand: an actual snooker table, cue, balls or shot, nothing else.
const TITLES = [
  "File:Snooker Cue.jpg",
  "File:Cue ball and reds.jpg",
  "File:Snooker table with balls in storage.jpg",
  "File:To pot the red.jpg",
  "File:GermanMasters 2011-Table setup.jpg",
  "File:Chalk on side of snooker table (51222671453).jpg",
];

const infoUrl =
  "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cmime&iiurlwidth=900" +
  `&titles=${encodeURIComponent(TITLES.join("|"))}`;
const infoResponse = await fetch(infoUrl, { headers: { "User-Agent": "Snookered-demo-seed/1.0" } });
if (!infoResponse.ok) throw new Error(`Wikimedia Commons lookup failed: ${infoResponse.status}`);
const infoData = await infoResponse.json();
const byTitle = new Map(Object.values(infoData.query?.pages ?? {}).map((page) => [page.title, page.imageinfo?.[0]]));

for (let i = 0; i < TITLES.length; i += 1) {
  const info = byTitle.get(TITLES[i]);
  if (!info?.thumburl) throw new Error(`${TITLES[i]} did not resolve on Wikimedia Commons - it may have been renamed.`);

  const response = await fetch(info.thumburl, { headers: { "User-Agent": "Snookered-demo-seed/1.0" } });
  if (!response.ok) throw new Error(`Could not fetch ${TITLES[i]}: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const storagePath = `${profile.id}/gallery-${i}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: "image/jpeg", upsert: true });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("coach_gallery_photos").insert({ coach_id: profile.id, path: storagePath });
  if (insertError) throw insertError;

  console.log(`  uploaded ${storagePath} (${TITLES[i]})`);
}

console.log("Done.");
