# Weg — North Star: the finished German app

Nov 12, 2026 · @Luis Felipe

## 1. The promise

Weg is a free Windows desktop app that takes an international student in Germany from zero to a passed B1 certificate, and on to C1, with nothing else needed except one human conversation a week. It is built only from methods with measured evidence, and it judges progress only by exam-format tests, never by its own streaks or scores.

**Who it is for.** International students (and graduates on the job-seeker permit) in Germany who study in English, need German to get hired, and need an official B1 certificate for settlement and citizenship. User #1 is LuisFe, currently at A2.1.

**What it guarantees.**

- One fixed path, A1.1 to C1.2. You always know your sublevel, your next step and how many hours are left.
- One daily session you start with one click. The app decides what to do; you do it.
- Every method in the app traces to evidence: spaced retrieval, explicit grammar, high-coverage input, corrected speaking and writing, pronunciation training.
- A sublevel ends only when you pass its gate test in Goethe/telc format.
- At B1.2 the app tells you, with a full mock exam, whether you are ready to book the real Goethe or telc B1.

**What it is not.**

- Not a game: no streaks, XP, leagues or hearts.
- Not a certificate: it prepares you for the official exam and says so.
- Not a content library: it gives you exactly one thing to do next.
- Not a replacement for all human contact: from A2 it schedules one human conversation a week, because no evidence yet shows AI practice alone transfers to a human-scored oral exam.

## 2. Success criteria (definition of done for v1.0)

v1.0 is done when all of the product checks pass and LuisFe has used it daily for at least 8 weeks. The outcome targets below are what the app is ultimately judged on; they take months and are tracked, not required for release.

| # | Criterion | How it is measured | Target |
| --- | --- | --- | --- |
| P1 | Full path specified | Every sublevel A1.1 to C1.2 has a validated spec (can-do, grammar, vocabulary, themes, gate) | 11 of 11 |
| P2 | Daily session runs end to end | One click starts SRS, grammar, input, speaking, writing, hours logged | Works offline except AI calls |
| P3 | Graded input fits the learner | Share of words in a generated text already known to that learner | 95% or more, checked automatically |
| P4 | Corrections are trustworthy | Corrector precision on the gold German test bank | 75% or more, else the edit is shown as "unsure" |
| P5 | Gate scoring is fair | Agreement of the app's gate score with a human rater on anchored samples | Within one band on 80% of samples |
| P6 | Cheap to run | Cost per learner per daily session | 0 EUR on free tiers, under 0.10 EUR with a paid key |
| P7 | Private by default | Recordings and progress leave the laptop | Never, except text/audio sent to the chosen AI provider |
| P8 | Installs cleanly | Fresh Windows 11 laptop, no admin, no Python | Under 5 minutes to first session |
| O1 | LuisFe reaches A2.2 | Passes the A2.2 gate, rated also by a human | This semester |
| O2 | Real exam pass | A user passes an official B1 certificate after following the path | First one, then track the pass rate |
| O3 | Transfer check | Monthly mock speaking sample rated by a human vs the app | Gap tracked every month |

The targets P4 to P6 are starting values set in this plan, not research findings; Fable's gold bank and the first weeks of real use will confirm or move them.

## 3. The learner journey

A learner installs the app, takes one placement test, and from then on repeats a single loop: daily sessions until the sublevel's hours are nearly done, then a gate test that either unlocks the next sublevel or opens a remedial week.

&#91;embedded content: learner journey · one loop per sublevel\]

The weekly human conversation feeds the same loop from A2 on. After the B1.2 mock exam says you are ready, the app's job for the certificate is to get you to book the real Goethe or telc B1, then you continue to B2 and C1.

## 4. The path: 11 sublevels, one direction

The path has 11 sublevels and about 1,010 hours of work from A1.1 to C1.2, built on the Goethe-Institut's evening-course plan (720 units of 45 minutes to C1) plus practice time. The hour budgets are a design assumption and get recalibrated from real users' data.

| Sublevel | Hours budget | You can do at the end (examples) | Grammar focus (examples) | Gate test |
| --- | --- | --- | --- | --- |
| A1.1 | 55 | Introduce yourself, numbers, times, shopping | Present tense, sein/haben, word order V2, nominative | 2-min self-introduction; short form + message |
| A1.2 | 55 | Appointments, directions, describe your flat | Accusative, modal verbs, separable verbs, Perfekt intro | Phone a doctor's office (role-play); 40-word email |
| A2.1 | 100 | Talk about your past, studies, health | Perfekt in full, dative, prepositions with cases | Narrate a weekend; informal email |
| A2.2 | 100 | Deal with the Ausländerbehörde, bank, landlord | Subordinate clauses (weil, dass, wenn), comparatives, reflexive verbs | Solve a problem at an office; complaint email |
| B1.1 | 100 | Give opinions, plan with others, talk about work | Präteritum, relative clauses, adjective endings | Plan an event with a partner (paired task) |
| B1.2 | 100 | Handle everyday work talk, short presentation | Passive, Konjunktiv II, infinitive clauses | **Full mock Goethe/telc B1** → book the real exam |
| B2.1 | 100 | Follow lectures and meetings, argue a point | Konjunktiv I (reported speech), complex connectors | 5-min argued presentation; formal letter |
| B2.2 | 100 | Job interview, negotiate, write reports | Nominal style, extended participles | Mock job interview; short report |
| B2.3 | 100 | Work fully in German on routine tasks | Register, idioms, error clean-up | **Full mock B2** (workplace focus) |
| C1.1 | 100 | Lead a meeting, write formal documents | Advanced syntax, academic and business register | Lead a discussion; formal opinion piece |
| C1.2 | 100 | Professional fluency in your field | Precision, style, field vocabulary | **Full mock C1** |

**Rules of the path.**

- You start where the placement test puts you; you never skip a gate.
- Failing a gate opens a targeted remedial week built from your error log, then a retake.
- At 75 minutes a day, a 100-hour sublevel takes about 11 to 12 weeks, close to LuisFe's level-targets (two sublevels a semester including university classes).
- The examples above are a first draft; Fable's curriculum spine replaces them with the full validated spec per sublevel.

## 5. Screen by screen

The app has seven screens, and the learner spends almost all their time in one of them: Today. Everything else exists to explain or adjust what Today asks for.

| Screen | What you see | What you can do |
| --- | --- | --- |
| **Today** (home) | Your sublevel, a single bar "42 of 100 hours", today's session as 5 blocks with minutes each, and one big Start button | Start or resume the session; nothing else competes for attention |
| **Session** (full screen) | One block at a time: SRS cards, then grammar, read/listen, speak, write; a thin progress line at the top | Answer by typing or speaking; pause; every block ends with a 1-line summary ("14 reviews, 2 lapses") |
| **Path** | The 11 sublevels as one vertical line; done ones ticked with gate score and date; current one open with its can-do list | Read what each sublevel teaches; see your gate results; nothing can be skipped |
| **Talk** | Conversation partner: a scenario card ("Call your landlord about the heating"), push-to-talk button, live transcript of what the app heard | Speak; get prompt-style feedback after the turn, not during; replay your audio next to a native model |
| **Write** | Prompt in exam format, word counter, timer | Submit; see corrections as hints first, then the fix with the rule named; unsure edits marked grey |
| **Progress** | Hours per skill per week, gate results, error patterns ("dative after mit: 9 errors this week"), monthly mock-speaking recordings | Export recordings for a human rater; export cards to Anki; see the exam-readiness estimate from B1.1 on |
| **Settings** | AI provider (Groq free, own key, local), voice, daily minutes, explanation language (English or Spanish) | Paste an API key; choose offline mode; delete all data in one click |

**Look and feel.** Calm and plain, like a good textbook: white space, one accent colour, large type for German text, no mascots or animations. Each screen works by keyboard. Explanations come in English or Spanish; everything you practise is in German.

## 6. The seven learning modules

Every minute of a session belongs to one of seven modules, and each module exists because a body of research supports it. A daily session of about 75 minutes uses modules 1 to 5; modules 6 and 7 come on their own schedule.

| Module | Minutes | Evidence it rests on |
| --- | --- | --- |
| 1. Wortschatz (SRS) | 15–20 daily | Spaced retrieval |
| 2. Grammatik | 10–15 daily | Explicit instruction |
| 3. Lesen/Hören (input) | 25–30 daily | High text coverage (about 98%) |
| 4. Sprechen | 10–15 daily | Pronunciation training, corrective feedback |
| 5. Schreiben | 10, 3–5 days a week | Corrective feedback (prompts before recasts) |
| 6. Gate and mock exam | once per sublevel | External, exam-format measurement |
| 7. Mensch | once a week from A2 | Live interaction; the transfer question |

**1. Wortschatz.** Cards are scheduled by FSRS and introduced in frequency order for the current sublevel, about 10 new a day. Each card shows the word with article and plural, a real example sentence and native audio. Reviews run in both directions, and the German side must be produced by typing or saying it, not just recognised. A lapse feeds the error log.

**2. Grammatik.** One structure per day: a short explanation (about 150 words, English or Spanish) with 3 examples and the typical mistake Spanish and English speakers make. Then 8 to 12 production drills (transform, complete, build, say aloud), interleaved with structures from earlier days.

**3. Lesen/Hören.** The app generates a text and its audio for this learner only: on the sublevel's theme, using today's grammar, with at least 95% of words already known from the SRS state. Unknown words are tappable and become new cards. Comprehension is checked by retelling, not multiple choice. Once a week the app instead links a real source at the right level (Easy German, Nicos Weg, nachrichtenleicht).

**4. Sprechen.** Three parts. Shadowing: repeat 5 lines from today's text and get hints on the sounds Spanish and English speakers find hard (ü, ö, ch, r, vowel length, final devoicing). Timed retell: summarise today's text in 60 to 90 seconds. Conversation: on 3 days a week, a role-play scenario with the AI partner, with feedback after the turn.

**5. Schreiben.** A short task in exam format (email, complaint, opinion), 60 to 200 words depending on level, timed. Feedback comes as hints first so you fix it yourself, then the corrected version with the rule named. Corrections that the grammar checker and the AI disagree on are marked "unsure".

**6. Gate and mock exam.** Unlocks when the sublevel's hours are 90% done. Timed speaking, writing, listening and reading tasks in Goethe/telc format, scored against a rubric with anchored sample answers. At B1.2, B2.3 and C1.2 it is a full mock exam with an exam-readiness verdict.

**7. Mensch.** From A2.1, one 30-minute conversation a week with a tandem partner or tutor. The app prepares a task card for both people, records the call if both agree, and analyses it afterwards like a Talk session. The app cannot provide the person; it makes the slot part of the path and tracks it.

## 7. AI behaviour rules

The app uses AI in four roles, and each role has written rules plus a test it must pass on the gold bank before a model is allowed in that role. A cheaper model replaces a better one only if it passes the same test.

| Role | Does | Must always | Must never | Passes if |
| --- | --- | --- | --- | --- |
| **Partner** (Talk) | Plays the other person in a scenario at your level | Stay in role; speak only at your sublevel's vocabulary and grammar; keep turns short; slow down when asked | Switch to English unasked; correct you mid-conversation; invent facts about German law or offices | Level-fit rate on scripted test dialogues meets the bar |
| **Coach** (feedback) | Comments after a turn or a text | Give a hint first so you can self-correct; then the fix with the rule named; limit to the 3 most important errors | Rewrite your whole text; praise without content; flag style as an error | Precision on gold learner sentences 75% or more |
| **Generator** (input, drills) | Writes texts, audio scripts, drills | Use 95% or more known words; use today's grammar; natural German | Use words outside the allowed list beyond 5%; copy copyrighted texts | Coverage check passes automatically on every text |
| **Examiner** (gates) | Scores gate tasks on the rubric | Score each criterion separately with a reason; mark low confidence | Pass a gate on a guess; give a CEFR "certificate" | Within one band of the human anchors on 80% of samples |

**Guardrails across all roles.**

- The grammar checker (LanguageTool) runs on every correction; disagreement = "unsure", shown grey.
- Speech recognition shows its transcript, so you see what it heard before you trust the feedback.
- Pronunciation feedback is a hint about a sound, never a numeric score at sound level.
- All AI output shown on screen is sanitised (no HTML or script injection).
- Every prompt lives in one versioned prompt library with its test results.

## 8. Under the hood

The app is a small Tauri 2 desktop program whose learning logic and data live entirely on the laptop. Every AI capability sits behind one swappable gateway, so a free tier that disappears costs a settings change, not a rewrite.

&#91;embedded content: architecture · app, gateway, providers\]

- **No Python and no bundled LLM in v1.** Heavy models are optional downloads on first use, not part of the installer.
- **Works offline** for SRS, grammar drills, reading cached texts and local TTS; AI conversation, generation and correction need a connection unless a local model is set up.
- **Export at any time** to Anki (.apkg) and JSON, so the learner owns their data.
- **Keys** are stored in the Windows credential store, never in files.

## 9. Quality bar

Nothing ships unless its automated tests and its AI evals pass, and the gold test bank is the single source of truth for whether AI output is good enough. A separate reviewer agent checks every change; the agent that wrote the code never approves it.

**The gold test bank (built with Fable, spot-checked by a German teacher).**

- About 300 German learner sentences with expert corrections and error tags (case, gender, word order, verb form, spelling, style).
- About 100 texts tagged by CEFR level.
- For every gate: tasks, rubric and 3 anchored sample answers per score band.
- 20 scripted Talk scenarios with expected partner behaviour.

**Checks on every change.**

- [ ] Unit tests for the engine: scheduler, session planner, hours ledger, coverage checker.
- [ ] Curriculum files validate against the schema; every sublevel complete.
- [ ] Evals for all four AI roles against the gold bank; results stored per model and prompt version.
- [ ] Security review: AI output sanitised, no secrets in the repo, API keys stored in the OS keychain.
- [ ] Licence check: every dependency, voice and dataset on the allowed list.
- [ ] Windows installer builds and opens on a clean machine.

**Release rule.** A release that lowers any eval score below its bar is blocked, even if all code tests pass.

## 10. Non-goals and hard rules

These rules hold for every version; changing one needs a written decision in the Startup area first.

**Hard rules.**

1. **Free while on the study permit.** No payments, subscriptions, ads or business registration. The permit's Zusatzblatt does not allow self-employment; the Migrationsamt must change that condition before the app earns its first euro.
2. **Permissive licences only.** MIT, Apache-2.0, CC0, CC BY, CC BY-SA, LGPL for libraries. No XTTS-v2 or other non-commercial models. DW, Goethe and textbook material is linked, never copied.
3. **Local data.** Progress and recordings stay on the laptop. Only the text or audio of a single request goes to the AI provider the user chose.
4. **Self-assessment, not certification.** Gate results are practice scores. The app never claims a CEFR level as official. (Automated grading of other people's learning outcomes is high-risk under the EU AI Act; obligations are postponed by Regulation (EU) 2026/1744, reportedly to December 2027.)
5. **Evidence first.** A feature without research support goes in only as a labelled experiment and is removed if it doesn't move gate results.

**Non-goals for v1.**

- Mobile app, web app or accounts and sync.
- Languages other than German; explanation languages other than English and Spanish.
- Social features, leaderboards, streaks, gamification.
- A bundled local LLM or a Python runtime inside the installer.
- Teacher dashboards or selling to universities.

## 11. Milestones to v1.0

The target is a free public v1.0 by mid-January 2027, with LuisFe using it daily from the end of November. Each phase ends at a gate; nothing moves on until the gate's criterion is met.

&#91;embedded content: roadmap · 5 phases, 4 gates\]

Dates after 16 Nov are targets set in this plan, not commitments. They assume about 30 to 45 minutes a day of review from LuisFe while AI agents build, and they leave the December holidays inside the Full path phase.
