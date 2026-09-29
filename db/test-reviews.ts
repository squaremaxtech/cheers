// Sample reviews for the demo professionals (db/test-professionals.ts), and
// the dummy guest accounts that "wrote" them.
//
// THIS IS SAMPLE CONTENT. Nobody booked these jobs and nobody wrote these
// reviews: they exist so that ratings, review lists and the "top-rated" strip
// have something to show on a development database and in demo footage. They
// are removed with everything else by `npm run test:clean`, and must never be
// presented as the words of real customers.
import { TEST_EMAIL_DOMAIN } from "../lib/test-mode";

export type GuestSeed = { email: string; name: string; phone: string };

const guest = (local: string, name: string, n: number): GuestSeed => ({
  email: `test.guest.${local}${TEST_EMAIL_DOMAIN}`,
  name,
  phone: `+1 876 555 01${String(n).padStart(2, "0")}`,
});

// Populate-only customers. They cannot be signed into.
export const GUESTS: GuestSeed[] = [
  guest("alicia", "Alicia B.", 50),
  guest("jermaine", "Jermaine T.", 51),
  guest("shanique", "Shanique W.", 52),
  guest("omar", "Omar R.", 53),
  guest("tashana", "Tashana M.", 54),
  guest("dwight", "Dwight C.", 55),
  guest("kerryann", "Kerry-Ann S.", 56),
  guest("andre", "Andre P.", 57),
  guest("simone", "Simone G.", 58),
  guest("ricardo", "Ricardo L.", 59),
  guest("natalee", "Natalee F.", 60),
  guest("kemar", "Kemar D.", 61),
];

// [rating, text]. A four-star review says what could have been better; a
// wall of identical five-star praise reads as exactly what it is.
type Sample = [rating: 3 | 4 | 5, body: string];

export const REVIEW_POOLS: Record<string, Sample[]> = {
  "djs-music": [
    [5, "Read the room from the first song. The dance floor was full by eleven and stayed that way."],
    [5, "Showed up early, sound-checked, and played every request on our list. Easy to deal with."],
    [5, "Clean edits for the corporate crowd, then turned it up when the bosses left."],
    [5, "Third time booking. Never the same set twice."],
    [4, "Good selection, though the set started about fifteen minutes late because of the venue's power."],
    [5, "Our guests are still asking who was playing."],
    [5, "Kept the energy up for four hours straight. Worth every dollar."],
    [5, "Professional from the first message. Sent a set outline a week before."],
    [4, "Strong set. We would have liked a little more soca in the last hour."],
  ],
  "mcs-hosts": [
    [5, "Kept the programme on time without rushing anybody. Pronounced every name right."],
    [5, "Funny without being crude — exactly what a staff awards needed."],
    [5, "Worked with our DJ like they had rehearsed it."],
    [5, "Handled a last-minute change to the running order like nothing happened."],
    [4, "Great energy. Could have checked the sponsor names with us beforehand, but the crowd loved him."],
    [5, "The crowd was shy until he picked up the microphone."],
  ],
  "sound-stage": [
    [5, "Clean sound right at the back of the lawn, and no feedback all evening."],
    [5, "Arrived with a backup amplifier and needed it. Nobody in the crowd ever knew."],
    [5, "Did a site visit the week before and told us exactly what power we needed."],
    [4, "Setup took a little longer than planned, but the mix was excellent."],
    [5, "The engineer stayed on the desk for the whole show. That is rare."],
  ],
  "lighting-visuals": [
    [5, "The room looked completely different once the lights came on. The photos came out beautifully."],
    [5, "Programmed the lights to our run sheet — the big moment landed perfectly."],
    [5, "Haze and moving heads made a hotel ballroom feel like a proper club."],
    [5, "Tidy rigging, no loose cables anywhere."],
    [5, "The visuals matched our flyer artwork exactly."],
    [4, "Very good. Ask for the cold sparks — we wished we had."],
  ],
  "photo-video": [
    [5, "Gallery in our inbox in four days. The low-light shots were sharp."],
    [5, "Caught moments we did not even know had happened."],
    [5, "The recap reel had our page busier than the event itself."],
    [5, "Quiet, fast, and everywhere at once."],
    [4, "Good photos. A few more crowd shots would have been nice."],
    [5, "Guests loved taking their prints home."],
    [5, "The stream never dropped, and the audio came straight from the desk."],
  ],
  "catering-bar": [
    [5, "The jerk chicken finished first, which tells you everything."],
    [5, "The bar never had a line longer than three people."],
    [5, "The signature cocktail was the talk of the evening."],
    [5, "Food was hot at ten o'clock and still hot at midnight."],
    [5, "Clean setup, staff in uniform, and they took everything away afterwards."],
    [4, "Lovely food. Portions for the vegetarian option could be bigger."],
    [5, "The cake was almost too pretty to cut."],
  ],
  "decor-styling": [
    [5, "Walked in and did not recognise the venue."],
    [5, "Matched our colours exactly from two reference photos."],
    [5, "Installed before doors and gone by morning, just as promised."],
    [5, "The balloon wall was in every guest's photos."],
    [4, "Beautiful work. The install ran close to doors, but it was finished in time."],
  ],
  "event-planning": [
    [5, "I was a guest at my own event. That was the whole point."],
    [5, "Every vendor knew where to be and when. The run sheet was a work of art."],
    [5, "Saved us more on vendors than the fee cost."],
    [5, "Calm under pressure when the rain came."],
    [4, "Very organised. Replies were sometimes slow in the last week, but the day was flawless."],
  ],
  performers: [
    [5, "Live over the DJ's set — the whole room had goosebumps."],
    [5, "Costumes, choreography, timing. A proper show."],
    [5, "Opening the launch that way had every phone in the air."],
    [5, "Learned our song in a week and played it better than the original."],
    [4, "A beautiful set. We only wished it was longer."],
    [5, "Walked through the crowd while playing. People loved it."],
    [5, "Professional, on time, and great with the audience."],
  ],
  "beauty-wardrobe": [
    [5, "Held through heat, dancing and happy tears."],
    [5, "Came to the hotel with everything. Six of us ready in three hours."],
    [5, "Understood my skin tone straight away."],
    [5, "Fresh cut and line-up before the party. Sharp."],
    [4, "Lovely work, just running a little behind schedule."],
  ],
  "venues-rentals": [
    [5, "Delivered the day before and collected the morning after, no chasing."],
    [5, "The furniture was clean and exactly as pictured."],
    [5, "The dance floor made the lawn usable."],
    [4, "Good value. One sofa had a small mark, which they replaced within the hour."],
  ],
  "power-technical": [
    [5, "The generator was so quiet that guests did not know it was there."],
    [5, "Calculated our load properly. Nothing tripped all evening."],
    [5, "The electrician stayed on call and sorted the caterer's extension in minutes."],
  ],
  "transport-logistics": [
    [5, "Everything counted on and off the truck against our list."],
    [5, "The crew were careful with the speakers and quick on the load-out."],
    [4, "Reliable. The truck was twenty minutes behind on the pickup, and they called ahead to say so."],
  ],
  "security-staffing": [
    [5, "Firm but polite on the door. No trouble all evening."],
    [5, "Guest list and wristbands handled without a queue."],
    [5, "The supervisor briefed us before doors and debriefed after."],
    [4, "A good team. We would have liked one more officer by the car park."],
    [5, "Professional, in uniform, and on time."],
  ],
};

// How many sample reviews each professional carries, by profile slug. The
// club acts carry the most; the supporting trades, a handful.
export const REVIEW_COUNTS: Record<string, number> = {
  "richie-blends": 14,
  "dj-nova": 11,
  "vinyl-vibes-sound": 9,
  "golden-hour-band": 8,
  "mc-dane-live": 10,
  "crystal-clear-sound": 7,
  "lumen-stage-lighting": 9,
  "pixel-wall-visuals": 5,
  "island-lens-studio": 6,
  "frame-by-kadeem": 6,
  "snap-booth-ja": 7,
  "copper-still-bar-co": 12,
  "spice-route-catering": 10,
  "sweet-hand-pastries": 6,
  "petal-and-drape-decor": 5,
  "bloom-and-bough-florals": 4,
  "blue-mahoe-events": 5,
  "sax-by-andre": 9,
  "soul-session-live": 5,
  "rhythm-roots-dancers": 8,
  "heartbeat-drummers": 4,
  "strings-on-the-shore": 3,
  "glow-by-shanice": 11,
  "crown-and-comb": 6,
  "lounge-and-table-rentals": 4,
  "volt-event-power": 3,
  "load-in-logistics": 3,
  "sentinel-event-staff": 7,
};
