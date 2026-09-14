/**
 * The 17 Erasmus V6 cognitive tasks, ranked in Round 2.
 *
 * Hardcoded rather than read from the database so this app is self-contained:
 * it shares a Supabase project with Round 1 but must not depend on Round 1's
 * `cases` and `sections` tables still existing.
 *
 * Sources, all in codebook order T1..T17:
 *   - title / guidingQuestion / definition: PACT_Literature_Review,
 *     taxonomy/pact_17_tasks.json
 *   - constructBoundary / exampleEd / examplePrimaryCare: the Round 1
 *     instrument's case seeds (PACT_EMC_V6_Tasks_CaseSeeds_1.xlsx, sheet
 *     "Cognitive Tasks")
 *   - round1 / selectedForBenchmark: Supplementary Table S1,
 *     "PACT_Delphi Results TableS1"
 *
 * Two entries have been revised by the study team since Round 1 and no longer
 * match their text source. Ratings are unaffected in both cases -- only the
 * wording changed -- so the Round 1 figures still stand.
 *
 *   - T1: now asks for a single global read at first contact whose output is
 *     pace and level of care.
 *   - T14 exampleEd: the original bundled three asks together and told the
 *     clinician to "reopen the case", which is task 4 and the one thing this
 *     construct's own boundary rules out. Replaced with a single ask that stays
 *     inside the clinician's own head.
 *
 * taskCode is load-bearing: the R analysis orders tasks by its numeric suffix.
 */

/**
 * Round 1 group results, shown back to panellists as Delphi feedback.
 *
 * Transcribed from Table S1 rather than computed live from the `ratings`
 * table, and this is deliberate. Table S1 excludes a complete submission
 * received 14 August 2026 -- after the round closed -- that recorded the scale
 * minimum on all three dimensions for all 17 tasks and was judged a platform
 * test entry, and it merges two panellist codes that shared one email. A live
 * average over `ratings` would silently reinstate the test entry and
 * double-count the merged panellist, so every number shown would disagree with
 * the published supplement.
 *
 * Values are as published, to two decimal places.
 */
export type Round1Means = {
  /** How much it matters that the task is done well. */
  clinicalRelevance: number;
  /** How much competent clinicians would disagree on the right path. */
  performanceVariance: number;
  /** Whether AI could meaningfully augment the task. */
  aiAugmentation: number;
  /**
   * Unweighted mean of the three dimension means -- Table S1's "Composite".
   * Taken as published rather than recomputed from the three rounded values
   * above, which would disagree in the last digit.
   */
  composite: number;
  /**
   * Rank on composite in Table S1, 1 (highest) to 17. Stored rather than
   * derived: two pairs tie on composite to two decimals (T5/T9 at 3.62,
   * T17/T13 at 2.98), so sorting on the rounded value alone would not
   * reproduce the published order.
   */
  tableS1Rank: number;
  /** Responding panellists for this task. Partial responses were retained. */
  n: number;
};

export type RankingTask = {
  taskCode: string;
  title: string;
  guidingQuestion: string;
  definition: string;
  /**
   * What this construct is NOT. Held here but deliberately not rendered: the
   * text refers to sibling constructs by codebook number ("drifted to task 4"),
   * which would collide with the 1-17 position numbers on the board.
   */
  constructBoundary: string;
  /** Worked example set in the Emergency Department. */
  exampleEd: string;
  /** Worked example set in Primary Care. */
  examplePrimaryCare: string;
  /**
   * In the 12-task set adopted at the leadership consensus meeting.
   *
   * A decision, not a computed field, and it does not follow composite rank
   * strictly: T5 ranks 5th on composite and was not selected, while T1 ranks
   * 14th and was. Those two are the whole of the difference.
   */
  selectedForBenchmark: boolean;
  round1: Round1Means;
};

export const TASKS: RankingTask[] = [
  {
    taskCode: "T1",
    title: "Rapid acuity appraisal",
    guidingQuestion: "How sick is this person, judged as a single global read at first contact?",
    definition: "Sick or not sick, and how sick, judged as a single global read at first contact on whatever is available at that moment: appearance, the triage note, vital signs, initial labs. The read is made before any workup settles the question, and it sets the pace and level of care.",
    constructBoundary: "Not a diagnosis and not an action. If the case forces a differential it has drifted to task 4; if it forces an admit or order decision it has drifted to task 11 or 2. It also borders task 8: what keeps this separate is that it stays a single global severity judgment made at first contact, whose output is pace and level of care, not an integrated interpretation of findings against a baseline.",
    exampleEd: "A 78-year-old brought in by ambulance for generalized weakness. The triage note reads \"weak, not herself since yesterday\"; heart rate 96, blood pressure 112/64, temperature 37.4 C; the first labs show a creatinine of 2.1 and a lactate of 3.0. Give a single global read of how sick she is, and set the pace and level of care, before any workup settles what is going on.",
    examplePrimaryCare: "A same-day add-on for two days of vomiting. Recorded vital signs are normal, but she looks exhausted and cannot sit up on the exam table. Give a single global read of how unwell she is right now, and decide whether this stays a clinic visit or escalates to higher-level care today.",
    selectedForBenchmark: true,
    round1: {
      clinicalRelevance: 4.73,
      performanceVariance: 2.40,
      aiAugmentation: 2.33,
      composite: 3.16,
      tableS1Rank: 14,
      n: 15,
    },
  },
  {
    taskCode: "T2",
    title: "Prioritisation & resource management",
    guidingQuestion: "What or whom next, and what do I spend on it?",
    definition: "Deciding what or whom to deal with next, and how to spend limited resources: attention, time, beds, staff, equipment, when several things compete.",
    constructBoundary: "Not the severity read that feeds the ranking (task 1), and not the clinician managing their own memory or attention (task 14).",
    exampleEd: "Four patients need attention at once: chest pain awaiting a second troponin, a laceration, a septic-appearing nursing home transfer, and a new intoxicated patient. One CT slot has opened and the nurse is asking who gets the room.",
    examplePrimaryCare: "The appointment schedule is running 40 minutes behind with a double-booked slot, a same-day add-on for chest tightness, and two urgent portal messages. Decide what gets attention in the next hour and what is deferred.",
    selectedForBenchmark: true,
    round1: {
      clinicalRelevance: 4.50,
      performanceVariance: 2.79,
      aiAugmentation: 3.43,
      composite: 3.57,
      tableS1Rank: 7,
      n: 14,
    },
  },
  {
    taskCode: "T3",
    title: "Directed information gathering & sufficiency",
    guidingQuestion: "What do I look for, and when have I got enough?",
    definition: "Steering their own search for information: what to look for or ask about, how to get it, and when there is enough to move on.",
    constructBoundary: "Not whether the information can be trusted (task 7), and not integrating findings already accepted as accurate (task 8). Stopping the search is this task; an unresolvable unknown is task 5.",
    exampleEd: "Ninety seconds of chart time before entering the room for an 82-year-old with syncope. Choose which few items to pull, prior ECGs, medication list, or last echocardiogram, and say when that is enough to start.",
    examplePrimaryCare: "Three months of fatigue with an open history to take in a 15-minute visit. Choose the questions that would actually separate thyroid disease, anaemia, depression and sleep apnoea, and stop when the picture is sufficient to order from.",
    selectedForBenchmark: true,
    round1: {
      clinicalRelevance: 4.29,
      performanceVariance: 3.36,
      aiAugmentation: 3.93,
      composite: 3.86,
      tableS1Rank: 3,
      n: 14,
    },
  },
  {
    taskCode: "T4",
    title: "Diagnostic reasoning",
    guidingQuestion: "What explains these findings, and which is most likely?",
    definition: "Building a set of possible explanations for the presentation and moving them up or down as evidence arrives, including noticing when the case does not fit the expected pattern.",
    constructBoundary: "Not the overall sick or not-sick read (task 1), and not keeping a diagnosis alive because of the danger of missing it (task 6).",
    exampleEd: "A 45-year-old with epigastric pain and diaphoresis has a normal ECG and a lipase of 60. ACS, pancreatitis, biliary disease and aortic pathology all remain live, and each returning result should move the ranking.",
    examplePrimaryCare: "A 60-year-old reports six weeks of cough without fever. Post-viral cough, ACE inhibitor effect, reflux, asthma and malignancy are all in play, and a normal chest film moves some candidates without clearing the list.",
    selectedForBenchmark: true,
    round1: {
      clinicalRelevance: 4.86,
      performanceVariance: 3.21,
      aiAugmentation: 3.93,
      composite: 4.00,
      tableS1Rank: 1,
      n: 14,
    },
  },
  {
    taskCode: "T5",
    title: "Managing uncertainty",
    guidingQuestion: "What cannot be known, and what do I do anyway?",
    definition: "Explicitly acknowledging what is unknown and choosing a next step that either tolerates it or resolves it, instead of forcing an answer too early. Includes safety-netting: naming in advance what would prompt a change of course.",
    constructBoundary: "The unknown must be stated explicitly. If the case moves a diagnosis up or down it is task 4; if the point is how dangerous a miss would be it is task 6.",
    exampleEd: "A 30-year-old with 12 hours of periumbilical pain has an equivocal ultrasound and a normal white count. Appendicitis cannot be excluded tonight. Say so explicitly, then set the return threshold and recheck interval that make discharge acceptable.",
    examplePrimaryCare: "An isolated mildly elevated alkaline phosphatase in an asymptomatic patient. Acknowledge that the cause cannot be established yet, deliberately leave it alone, and name the repeat interval and the value that would prompt a workup.",
    selectedForBenchmark: false,
    round1: {
      clinicalRelevance: 4.50,
      performanceVariance: 3.50,
      aiAugmentation: 2.86,
      composite: 3.62,
      tableS1Rank: 5,
      n: 14,
    },
  },
  {
    taskCode: "T6",
    title: "Risk stratification & risk tolerance",
    guidingQuestion: "How bad is it to be wrong here?",
    definition: "Weighing how dangerous it would be to be wrong: keeping cannot-miss diagnoses in play, matching how aggressive to be to the worst case, and locating their own threshold for acting.",
    constructBoundary: "Risk words alone do not qualify. Something must be balanced, and the subject is how bad it is to be wrong, not how likely the diagnosis is (task 4).",
    exampleEd: "A 55-year-old with atypical chest pain and a HEART score of 3. Reason explicitly about how low the acceptable miss rate for ACS is, and whether that threshold justifies observation rather than discharge.",
    examplePrimaryCare: "A 40-year-old with a new severe headache and a normal neurological examination. Weigh how bad a missed subarachnoid haemorrhage would be against the yield and cost of sending her to the ED today, and say where your own threshold sits.",
    selectedForBenchmark: true,
    round1: {
      clinicalRelevance: 4.64,
      performanceVariance: 3.29,
      aiAugmentation: 3.29,
      composite: 3.74,
      tableS1Rank: 4,
      n: 14,
    },
  },
  {
    taskCode: "T7",
    title: "Judging credibility & completeness",
    guidingQuestion: "Can I trust this source, and what is missing?",
    definition: "Judging whether incoming information can be trusted and whether anything is missing: checking the source, deciding whether to verify it first-hand, and flagging the gap.",
    constructBoundary: "Not information simply acknowledged as missing (task 5), and not trusting a person's judgement or work (task 13). This is about the source, not the person.",
    exampleEd: "The only history for an unresponsive patient runs from a bystander to a paramedic to a triage note. Judge how much of that chain to believe, and decide what to re-check personally before committing.",
    examplePrimaryCare: "An outside note asserts a normal stress test 14 months ago, with no report attached and no images available. Decide whether that assertion can carry weight, or whether the study must be obtained or repeated.",
    selectedForBenchmark: false,
    round1: {
      clinicalRelevance: 4.00,
      performanceVariance: 2.93,
      aiAugmentation: 2.36,
      composite: 3.10,
      tableS1Rank: 15,
      n: 14,
    },
  },
  {
    taskCode: "T8",
    title: "Weighing & integrating information",
    guidingQuestion: "What do these findings mean when taken together?",
    definition: "Relating several findings, all accepted as accurate, to one another, to this patient's own baseline, and to how they were previously, in order to arrive at a single interpretation.",
    constructBoundary: "Not judging whether a source is trustworthy (task 7), and not ranking candidate diagnoses (task 4). The findings are already accepted as accurate.",
    exampleEd: "An 85-year-old's blood pressure is 104/60 — normal by population standards, but 40 points below his own documented baseline — and his creatinine has risen since a value six months ago. Interpret these findings together, and against his own baseline.",
    examplePrimaryCare: "The patient feels well, her A1c is 11.2, her home glucose log shows values in the 120s, and last year's A1c was 6.8. All three are accepted as accurate. Give a single coherent interpretation.",
    selectedForBenchmark: true,
    round1: {
      clinicalRelevance: 4.14,
      performanceVariance: 3.14,
      aiAugmentation: 3.29,
      composite: 3.52,
      tableS1Rank: 8,
      n: 14,
    },
  },
  {
    taskCode: "T9",
    title: "Knowledge & protocol retrieval",
    guidingQuestion: "What do I know, or need to look up?",
    definition: "Retrieving stored medical knowledge, rules or standards from memory, or looking them up, and applying them to the case — including recognising the limits of one’s own knowledge.",
    constructBoundary: "Not looking up the patient's own chart data (task 3 or 8). A passage that merely sounds medical, with nothing retrieved and no gap named, does not qualify.",
    exampleEd: "A patient on apixaban has an intracranial bleed. Retrieve the reversal agent, the dose and the time window, and identify the point at which recall runs out and an outside source is needed.",
    examplePrimaryCare: "A 67-year-old asks about pneumococcal vaccination, with a prior dose at 63. Recall the current interval and sequence, and recognise that the schedule has changed and needs looking up.",
    selectedForBenchmark: true,
    round1: {
      clinicalRelevance: 4.07,
      performanceVariance: 2.36,
      aiAugmentation: 4.43,
      composite: 3.62,
      tableS1Rank: 6,
      n: 14,
    },
  },
  {
    taskCode: "T10",
    title: "Anticipatory planning & forward projection",
    guidingQuestion: "Where is this heading, and what does that change now?",
    definition: "Looking ahead to the likely trajectory, endpoint and next moves, and letting that forecast change what is done now, before a decision is reached.",
    constructBoundary: "Two or more futures must still be open. One settled endpoint, or a single pending result that will decide it, is task 11. Parking a to-do so as not to forget it is task 14.",
    exampleEd: "A probable small bowel obstruction, not yet confirmed. Plan forward: if the CT confirms it, surgery is called and a nasogastric tube goes in now; if it is negative, the patient goes home. Sequence the immediate work so that it holds up either way.",
    examplePrimaryCare: "A patient with early dementia is still driving and living alone. Both are tolerable today but likely to become unsafe as the dementia progresses. Project the coming year, then decide what to begin now rather than after a crash or a fall forces it — assessing decision-making capacity, addressing driving, identifying a surrogate decision-maker — and what to hold over to a follow-up visit.",
    selectedForBenchmark: true,
    round1: {
      clinicalRelevance: 3.79,
      performanceVariance: 3.14,
      aiAugmentation: 3.36,
      composite: 3.43,
      tableS1Rank: 12,
      n: 14,
    },
  },
  {
    taskCode: "T11",
    title: "Committing to an endpoint & disposition",
    guidingQuestion: "Where does this patient end up, and what settles it?",
    definition: "Bringing everything together into a final disposition and plan, and judging whether a pending test or action is worth pursuing based on whether its result would actually change that plan.",
    constructBoundary: "The reasoning toward the endpoint must be present, not the endpoint alone. Predicting a likely endpoint before the data is back is task 10. Bare words like admit or discharge are not codable.",
    exampleEd: "Flank pain with a known stone history, pain controlled and creatinine normal. Settle that the disposition hangs on the urinalysis alone, and say whether the CT is worth doing given that the result would not change management.",
    examplePrimaryCare: "Three weeks of low back pain with no red flags, and the patient is asking for an MRI. Decide whether the scan would change the plan, commit to a management course with a follow-up interval, and close the visit on that reasoning.",
    selectedForBenchmark: true,
    round1: {
      clinicalRelevance: 4.15,
      performanceVariance: 3.31,
      aiAugmentation: 3.08,
      composite: 3.51,
      tableS1Rank: 9,
      n: 13,
    },
  },
  {
    taskCode: "T12",
    title: "Patient-centred reasoning & communication",
    guidingQuestion: "What does this patient need, and how do I say it?",
    definition: "Folding the patient's situation, goals, understanding, preferences and feelings into the reasoning and the plan, and deliberately shaping how things are communicated to fit them.",
    constructBoundary: "Not talking to other clinicians (task 13), and not judging whether the patient's account is reliable (task 7). Noticing a communication habit without changing anything is task 14.",
    exampleEd: "New atrial fibrillation in a patient who lives alone, has limited health literacy and no reliable transport. Let that situation change both the anticoagulation choice and the way return precautions are explained.",
    examplePrimaryCare: "An 82-year-old with an abnormal screening result says she does not want anything invasive. Work out what she actually understands and fears, and let that reshape both the plan and how the result is delivered.",
    selectedForBenchmark: true,
    round1: {
      clinicalRelevance: 4.00,
      performanceVariance: 3.29,
      aiAugmentation: 3.14,
      composite: 3.48,
      tableS1Rank: 10,
      n: 14,
    },
  },
  {
    taskCode: "T13",
    title: "Team & distributed cognition",
    guidingQuestion: "What is someone else thinking, doing, or responsible for?",
    definition: "Reasoning about and through other people: how far to trust a colleague, what to do themselves versus hand over, checking someone else's plan, passing on responsibility, and coordinating with other services.",
    constructBoundary: "A colleague being present in the case is not enough. Trust, delegation, the worth of that person's information, or who is responsible must be at issue. Trusting a document or monitor is task 7.",
    exampleEd: "A second-year resident presents a syncope patient as low risk. Judge how far to trust this particular resident, decide whether to see the patient personally, and check the plan for what a resident at that level would likely miss.",
    examplePrimaryCare: "A patient's insulin was adjusted by an endocrinologist last week, and the assistant has recorded home readings that conflict with that plan. Work out who owns the prescription now and what the specialist is actually planning.",
    selectedForBenchmark: false,
    round1: {
      clinicalRelevance: 3.50,
      performanceVariance: 3.21,
      aiAugmentation: 2.21,
      composite: 2.98,
      tableS1Rank: 17,
      n: 14,
    },
  },
  {
    taskCode: "T14",
    title: "Metacognitive self-regulation",
    guidingQuestion: "What is my own mind doing, and how do I manage it?",
    definition: "Watching their own reasoning, confidence and biases, and deliberately managing their own attention, effort and memory.",
    constructBoundary: "Only the clinician's own mind. Spending external resources or ranking patients is task 2. Handing work to someone else is task 13. Frustration at what others are doing is neither.",
    exampleEd: "A patient signed out as \"intoxicated, sleeping it off\" has been on the board four hours, and you notice you have walked past the room twice without looking in. Say explicitly that you have anchored on the handoff label, and name what it would take to change your mind.",
    examplePrimaryCare: "At the end of a long appointment, notice your own engagement dropping and that you are rushing a complex patient. Slow down deliberately and re-check the medication list you have just reviewed.",
    selectedForBenchmark: false,
    round1: {
      clinicalRelevance: 3.50,
      performanceVariance: 3.50,
      aiAugmentation: 2.79,
      composite: 3.26,
      tableS1Rank: 13,
      n: 14,
    },
  },
  {
    taskCode: "T15",
    title: "Multi-patient monitoring",
    guidingQuestion: "Across all my patients, is everything moving and is anything missed?",
    definition: "Going back over the whole set of patients mid-shift: re-triaging across patients by acuity, tracking that orders and results are moving, and confirming nothing has been missed.",
    constructBoundary: "Set-level, not one patient. A single endpoint decision is task 11, a single severity read is task 1, and choosing who to see next as an attention call is task 2.",
    exampleEd: "Mid-shift sweep of the whole board. Bed 16 has blood running and imaging back, bed 36's labs are reassuring and she can wait, bed 22 has been waiting two hours on an ultrasound that has not moved. Confirm nothing on the list has been dropped.",
    examplePrimaryCare: "End-of-week panel sweep: three abnormal results with no documented follow-up, two referrals never scheduled, and one biopsy result still outstanding. Establish what has stalled and what needs action now.",
    selectedForBenchmark: true,
    round1: {
      clinicalRelevance: 4.07,
      performanceVariance: 3.14,
      aiAugmentation: 4.64,
      composite: 3.95,
      tableS1Rank: 2,
      n: 14,
    },
  },
  {
    taskCode: "T16",
    title: "Feasibility & system navigation",
    guidingQuestion: "Can this even happen here, and if not, how?",
    definition: "Judging whether a plan can actually be carried out, given coverage, cost, appointment supply, service hours and who controls access, and working out a route around the block when there is one.",
    constructBoundary: "The constraint must belong to the system, not the patient. What the patient can afford or get to is task 12. Cost as one factor in choosing between treatments is task 11.",
    exampleEd: "The patient needs an MRI this hospital does not perform overnight, and the on-call neurosurgeon covers a second site. Reason about boarding until morning, transferring, or managing without the study.",
    examplePrimaryCare: "The guideline-preferred agent is not covered, prior authorisation takes three weeks, and the next endocrinology appointment is five months out. Work out which available route actually gets treatment started.",
    selectedForBenchmark: true,
    round1: {
      clinicalRelevance: 3.86,
      performanceVariance: 3.36,
      aiAugmentation: 3.14,
      composite: 3.45,
      tableS1Rank: 11,
      n: 14,
    },
  },
  {
    taskCode: "T17",
    title: "Encounter scoping",
    guidingQuestion: "What is this visit about, and what else goes in it?",
    definition: "Fixing what this contact is meant to be for and which of the patient's problems it will carry, including deciding to open something the patient did not come in about, or deliberately to leave something out.",
    constructBoundary: "The subject is what the contact will cover, not what information to look for (task 3) or where the illness is heading (task 10). Deciding a problem belongs to someone else is task 13.",
    exampleEd: "A frequent attender arrives with five active complaints and a request for a work note. Fix which single problem this visit will carry, and say why the others are not opened today.",
    examplePrimaryCare: "The visit is booked as routine diabetes and hypertension follow-up. At minute 12 the patient mentions exertional chest tightness. Re-frame what this contact is now for, and what is left for next time.",
    selectedForBenchmark: false,
    round1: {
      clinicalRelevance: 3.50,
      performanceVariance: 2.86,
      aiAugmentation: 2.57,
      composite: 2.98,
      tableS1Rank: 16,
      n: 14,
    },
  },
];

export const TASK_COUNT = TASKS.length;

/** Size of the adopted task set, and so where the cut line sits. */
export const SELECTED_COUNT = TASKS.filter((task) => task.selectedForBenchmark).length;

/**
 * The 17 tasks in the order every panellist is shown them: the adopted 12
 * first, then the 5 that were not selected, each group by composite rank.
 *
 * Identical for everyone by design. Round 2 asks panellists to adjust a
 * proposed set rather than build one from scratch, so the order is the
 * stimulus and must not vary between them.
 *
 * Note this is not composite order. Selection was a decision rather than a
 * cutoff, so T1 (composite 3.16) sits at position 12 while T5 (3.62) sits at
 * 13 -- the one place where a lower aggregate appears above a higher one. The
 * instrument says so on the page, otherwise it reads as a defect.
 */
export const PRESENTED_ORDER: RankingTask[] = [...TASKS].sort((a, b) => {
  if (a.selectedForBenchmark !== b.selectedForBenchmark) {
    return a.selectedForBenchmark ? -1 : 1;
  }
  return a.round1.tableS1Rank - b.round1.tableS1Rank;
});
