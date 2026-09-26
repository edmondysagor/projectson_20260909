# 03_New_Project_Kickoff_Meeting

**Meeting Type:** First Project Kickoff  
**Date:** 2026-09-21  
**Time:** 15:00–16:15  
**Location:** Teams Meeting  
**Project:** Smart Queue Assistance  
**Transcript Type:** Raw / conversational transcript for AI extraction testing

## Participants

- Edmond — Project Lead
- Karen — Business Owner / Customer Operations
- Michael — IT / Technical Representative
- Rachel — UX / Service Design
- Thomas — Airport Operations Representative

---

## Transcript

**15:00 — Edmond:**  
Okay, thanks everyone. This is the first meeting for the smart queue thing. I think the working name is Smart Queue Assistance, right? Karen, you called it Passenger Queue Assistant in the email.

**Karen:**  
Yeah, that's basically the same thing. I don't think we've agreed on the final name yet. Smart Queue Assistance is fine for now.

**Edmond:**  
Okay, let's use Smart Queue Assistance as the working name. We can sort out the official name later. The main reason we're here is because the airport teams are getting complaints about passengers not knowing which queue they should join, especially during the morning peak.

**Thomas:**  
That's definitely happening. At Terminal 1, when several flights are boarding around the same time, people just follow whoever is standing in front of them. Sometimes they queue for the wrong counter and then we have to redirect them.

**Karen:**  
Right. From the business side, I'd like the system to help passengers identify the appropriate queue before they spend five or ten minutes standing in the wrong place. Ideally they scan something, answer a couple of questions, and then it tells them where to go.

**Rachel:**  
When you say scan something, do you mean a QR code from the boarding pass?

**Karen:**  
That's one option. I don't want us to decide the design today. It could be boarding pass scanning, manual flight number, maybe even something on the kiosk.

**Edmond:**  
Good distinction. So the problem is clear, but the actual interaction method isn't fixed yet.

**Michael:**  
From IT's side, flight information shouldn't be a big problem. We already have access to the flight schedule feed. The question is whether we can get the queue status in real time.

**Thomas:**  
Queue status is messy. Some counters are technically open but we're not actually sending passengers there because the agent is dealing with something else.

**Michael:**  
Exactly. So if we're saying "real-time queue availability", we need to define what real time means and which system is the source.

**Karen:**  
For the first version, I don't need every counter. If we can tell the passenger which of the main queues they should use, that's already useful.

**Edmond:**  
Would you consider that the first release scope?

**Karen:**  
Yes, probably. But I would still like the system to show the estimated waiting time eventually.

**Rachel:**  
Eventually meaning phase one?

**Karen:**  
No, sorry. I mean eventually as in future. It would be nice, but I don't want it to hold up the first release.

**Edmond:**  
Okay, let's make that explicit. Estimated waiting time is not part of the initial release.

**Michael:**  
That makes integration much easier.

**Thomas:**  
Can we also exclude staff allocation? Because someone will definitely ask us to make the system tell supervisors how many agents they should move between queues.

**Karen:**  
That's a different project.

**Edmond:**  
Agreed. Staff allocation is out of scope.

**15:12 — Rachel:**  
What exactly does "appropriate queue" mean? If it's based on flight, we need to know whether passengers with special assistance, families, or certain travel documents should be routed differently.

**Thomas:**  
Special assistance definitely needs a different path in some cases.

**Karen:**  
But don't turn this into a giant rules engine. For the first version, let's support the normal passenger flow. Special assistance can be handled by staff.

**Rachel:**  
Okay. So normal passenger flow only for phase one, with special assistance excluded?

**Karen:**  
Yes, for now.

**Edmond:**  
Let's capture that as scope. We should probably have a rule that if the passenger doesn't match the normal flow, the system tells them to seek staff assistance rather than guessing.

**Michael:**  
That makes sense. Technically, I'd rather have a safe fallback than an incomplete rules engine.

**Thomas:**  
Yes.

**15:18 — Edmond:**  
Let's talk about success criteria. Karen, what would make you say this worked?

**Karen:**  
Fewer passengers joining the wrong queue. If we can reduce wrong-queue cases by around 30 percent, I'd be happy.

**Thomas:**  
Do we have a baseline?

**Karen:**  
Not a reliable one. We have some manual observations from operations, but nothing I'd call an official baseline.

**Edmond:**  
Then let's not pretend 30 percent is a confirmed KPI yet. We can record it as a proposed target and define the baseline separately.

**Karen:**  
Fair.

**Rachel:**  
What about response time? If someone is standing at a kiosk waiting five seconds for an answer, they'll just walk away.

**Michael:**  
I can probably get the response under three seconds, but I'd need to check the downstream dependency.

**Edmond:**  
Is that a commitment?

**Michael:**  
No, it's an initial technical estimate. I need to validate it.

**Edmond:**  
Good. Let's record "target response time under three seconds" as something to validate, not as a confirmed requirement.

**15:25 — Michael:**  
There is another issue. The flight schedule feed is available, but I don't know yet whether the queue mapping data is exposed through the same interface. If not, we'll need another integration.

**Edmond:**  
Is that a blocker?

**Michael:**  
Not yet. It's a dependency / technical unknown.

**Karen:**  
Who can confirm it?

**Michael:**  
I can check with the Airport Systems team.

**Edmond:**  
Can you take that action and come back next week?

**Michael:**  
Yes.

**Rachel:**  
And I'll need to speak to a few passengers or front-line staff before we decide the screen flow. Otherwise we're designing from assumptions.

**Edmond:**  
Good. Can you arrange five short interviews?

**Rachel:**  
Five passengers or five staff?

**Thomas:**  
I'd suggest three passengers and two frontline staff.

**Rachel:**  
Okay, three passengers and two frontline staff.

**Edmond:**  
Let's do that.

**15:32 — Thomas:**  
One thing I don't want is another dashboard project. Operations doesn't need a giant screen with twenty metrics. We need something that helps the passenger make the right choice.

**Karen:**  
Agreed. Though later we may want an operations view showing how often the system sends people to each queue.

**Edmond:**  
Later is fine. For phase one, passenger guidance is the focus.

**Michael:**  
Would the operations view be completely excluded or just not part of the first release?

**Edmond:**  
Not part of the first release. We shouldn't necessarily say it can never happen.

**Karen:**  
Yes, future phase.

**15:37 — Rachel:**  
For the actual recommendation, should the system say "Go to Queue A" or should it explain why?

**Karen:**  
Explain why. If it just points somewhere, passengers may not trust it.

**Thomas:**  
Maybe something simple like "Your flight is currently handled at Queue A."

**Michael:**  
That depends on what data we have.

**Edmond:**  
The exact wording can be designed later. The principle is that the result should be understandable to the passenger.

**Rachel:**  
Got it.

**15:42 — Edmond:**  
Let's talk timeline. I was thinking we could have the initial requirements and user flow agreed by October 2, a prototype around October 16, then some kind of operational trial in early November.

**Karen:**  
October 16 sounds okay.

**Michael:**  
Prototype by October 16 is possible if the integration question doesn't become a problem.

**Thomas:**  
Early November is a bit aggressive because of the peak-period preparation.

**Edmond:**  
Would November 13 be more realistic?

**Thomas:**  
Yes, I think so.

**Karen:**  
I'm okay with November 13.

**Edmond:**  
Okay, let's tentatively put November 13 for the operational trial.

**Michael:**  
And October 2 for requirements baseline?

**Edmond:**  
Tentatively, yes. I don't want to call it final until Rachel's interviews and the integration check are done.

**Rachel:**  
That works.

**15:50 — Karen:**  
There's one more thing. The business team would eventually like the system to support multiple terminals, not just Terminal 1.

**Edmond:**  
Is that phase one?

**Karen:**  
No. Let's prove it in Terminal 1 first.

**Thomas:**  
Definitely Terminal 1 first.

**Michael:**  
That also keeps the integration scope manageable.

**Edmond:**  
Okay, Terminal 1 is the initial deployment scope. Other terminals are future expansion.

**15:54 — Rachel:**  
What about language? If we're helping passengers, English alone won't be enough.

**Karen:**  
At least Chinese and English.

**Thomas:**  
And maybe Japanese and Korean during peak tourism periods.

**Edmond:**  
Let's not turn that into a commitment yet. Chinese and English sound like the initial requirement. Additional languages can be assessed after we understand usage.

**Rachel:**  
Fine.

**16:00 — Michael:**  
For security, are we storing passenger information?

**Karen:**  
I assumed we'd just read the boarding pass and then discard it.

**Michael:**  
We need to confirm that. Depending on the scanning method, there may still be logs.

**Edmond:**  
Good point. We shouldn't decide data retention verbally without checking with the security/privacy team.

**Karen:**  
Can you check that?

**Michael:**  
Yes, I'll include it with the integration check.

**16:05 — Thomas:**  
I think we also need an escape route. If the system can't determine the correct queue, it shouldn't just send them somewhere random.

**Edmond:**  
Agreed. That sounds like a core safety principle.

**Rachel:**  
Could the fallback just say "Please see a staff member"?

**Karen:**  
Yes.

**Michael:**  
Technically straightforward.

**Edmond:**  
Okay, let's capture that: when the system cannot confidently determine the appropriate queue, it should direct the passenger to staff assistance rather than make an uncertain recommendation.

**16:10 — Edmond:**  
Let me summarize what I think we've agreed, and please stop me if I get anything wrong.

We're starting with Smart Queue Assistance as the working project name. The first release is for Terminal 1 and normal passenger flow. The main goal is to reduce passengers joining the wrong queue. Estimated waiting time, staff allocation, and an operations dashboard are not part of the first release. Chinese and English are expected for the initial experience.

We have a proposed 30 percent reduction in wrong-queue cases, but we don't have a reliable baseline yet, so that's a target to validate rather than a confirmed KPI. Response time under three seconds is also a technical target to validate.

Before we lock the requirements, Rachel will do three passenger and two frontline interviews. Michael will check the queue-data integration and the security/privacy implications of the passenger information flow. We'll tentatively aim for requirements baseline on October 2, prototype on October 16, and an operational trial on November 13.

And if the system can't confidently determine the correct queue, it sends the passenger to staff assistance.

Anything missing?

**Karen:**  
No, that covers it.

**Michael:**  
Yes.

**Rachel:**  
All good.

**Thomas:**  
Yep.

**Edmond:**  
Great. We'll use the next meeting to review the interview findings and integration check before treating the requirements as baseline.

**16:15 — Meeting ended.**

---

## Transcript Testing Notes

This transcript intentionally contains conversational ambiguity and should be processed as source evidence rather than as a pre-structured project specification.

Potentially important distinctions embedded in the conversation include:

- Working name vs confirmed final project name.
- Proposed KPI vs confirmed KPI.
- Technical estimate vs confirmed requirement.
- Future idea vs first-release scope.
- Tentative date vs confirmed milestone.
- Technical dependency vs blocker.
- Action item vs discussion.
- Explicit decision vs suggestion.
- Initial scope vs future expansion.
- Safety/fallback principle vs ordinary feature.
- Information that still requires validation.

The transcript does **not** provide a pre-built item list, IDs, traceability matrix, or explicit item types. Any structured project records should therefore be grounded in the actual conversation evidence.
