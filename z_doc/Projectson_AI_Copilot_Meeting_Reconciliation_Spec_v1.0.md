# Projectson AI Copilot --- Meeting Intelligence & Structured Memory Reconciliation

## Implementation Specification v1.0

> **Purpose:** This document is for Antigravity / the vibe-coding
> implementation agent.
>
> **Core product principle:** Projectson is not merely an AI chatbot or
> text generator. Its PoC essence is **Structured AI Memory**:
> converting human project conversations and documents into structured,
> persistent, traceable project memory, while reconciling new
> information with existing memory before proposing changes.

------------------------------------------------------------------------

# 1. Executive Objective

Improve the existing Projectson AI Copilot so that it can reliably
process an uploaded Meeting Recap even when the document does **not**
contain Projectson item codes such as `TPM-241`.

The target workflow is:

``` text
Meeting Recap
    ↓
Understand / Parse
    ↓
Extract Candidate Items
    ↓
Normalize
    ↓
Retrieve Relevant Existing Project Memory
    ↓
Reconcile Each Candidate
    ↓
CREATE / UPDATE / NO_CHANGE / REVIEW_REQUIRED / IGNORE
    ↓
Build / Update Traceability
    ↓
Validate
    ↓
Generate Proposal
    ↓
Human Review / Approval
    ↓
Database Write
```

The system must be substantially more reliable than a single LLM call
that attempts to perform all of these operations simultaneously.

------------------------------------------------------------------------

# 2. Existing Functionality Must Be Preserved

Before making changes, inspect the existing implementation.

The current Copilot already supports relatively simple instructions such
as:

-   "Create a new task..."
-   "Change this task to In Progress."
-   "Update a specific task."

These workflows are already useful and should not be unnecessarily
replaced.

The main problem being addressed is the more complex Meeting Recap
workflow.

Do not rewrite the whole Copilot simply to implement this feature.

First identify reusable components.

------------------------------------------------------------------------

# 3. Required First Step: Inspect the Existing System

Before coding, inspect:

## Frontend

-   AI Copilot UI
-   Chat interface
-   Proposal / Canvas UI
-   Approval flow
-   Existing Traceability UI
-   Existing item creation/update UI

## Backend

-   Copilot API
-   LLM calls
-   Agent orchestration
-   Existing prompts
-   JSON schemas
-   Validation
-   Database write functions

## Database

Inspect the actual schema for:

-   Objective
-   Requirement
-   User Story
-   Task
-   UAT
-   Deployment
-   Meeting
-   Decision
-   Information
-   Bug
-   Event
-   Milestone
-   other item types

Also inspect:

-   item UID generation
-   item display code generation
-   parent-child relationships
-   relation tables
-   project/workspace relationships
-   audit fields
-   existing source/reference fields, if any

## Existing Meeting Workflow

Determine:

1.  How files are uploaded.
2.  How text is extracted.
3.  How the LLM receives the content.
4.  How existing Project items are retrieved.
5.  How proposed items are generated.
6.  How proposals are validated.
7.  How the user approves changes.
8.  How approved changes are written to the DB.

------------------------------------------------------------------------

# 4. Core Design Principle: Structured AI Memory

Projectson should behave as:

``` text
Human Conversation
        ↓
AI Understanding
        ↓
Structured Memory
        ↓
Reconciliation
        ↓
Action
        ↓
New Evidence
        ↓
Updated Structured Memory
```

A Meeting Recap is an unstructured or semi-structured source.

The Projectson database is the structured memory.

Therefore the AI must not simply "generate project items".

It must determine:

> Does this information represent something new, a change to existing
> memory, information Projectson already knows, or an ambiguous case?

------------------------------------------------------------------------

# 5. Important Constraint: Meeting Recaps May Not Contain Item Codes

A Meeting Recap may say:

-   "Develop the Cloud Run verification endpoint."
-   "Add dual-screen UI."
-   "Support QR and face recognition."
-   "Perform load testing for 500 concurrent users."

It may contain no:

-   `TPM-241`
-   `TPM-245`
-   `REQ-xxx`
-   `US-xxx`

Therefore the AI must NOT depend on item codes inside the document.

Instead:

``` text
Meeting text
    ↓
Candidate Item
    ↓
Match Candidate against Projectson memory
    ↓
Determine existing item / new item
```

Candidate IDs are temporary analysis identifiers, not Projectson
database IDs.

------------------------------------------------------------------------

# 6. Architecture

Use staged processing rather than one large LLM call.

Recommended conceptual modules:

``` text
MeetingParser
CandidateNormalizer
MemoryRetriever
ItemReconciler
TraceabilityPlanner
ProposalPlanner
GraphValidator
BusinessRuleValidator
SchemaValidator
ProposalRepairer
ApprovalService
DatabaseWriter
```

These do not necessarily need to be separate AI agents.

Prefer normal application code for deterministic operations.

Use LLM reasoning only where semantic interpretation is actually
required.

------------------------------------------------------------------------

# 7. Responsibility Split: LLM vs Application Code

## LLM SHOULD HANDLE

-   Natural language understanding
-   Meeting interpretation
-   Candidate extraction
-   Semantic matching
-   Understanding whether two descriptions represent the same underlying
    work
-   Identifying implicit relationships when evidence supports them
-   Explaining why an item should be CREATE / UPDATE / NO_CHANGE
-   Identifying ambiguity

## APPLICATION CODE SHOULD HANDLE

-   Database queries
-   Database writes
-   IDs
-   item UID generation
-   schema validation
-   enum validation
-   required fields
-   file hashing
-   duplicate file detection
-   relationship integrity
-   transaction handling
-   approval state
-   audit logging
-   coverage validation
-   deterministic business rules

Do not ask the LLM to perform deterministic tasks that application code
can enforce.

------------------------------------------------------------------------

# 8. Stage 1 --- Meeting Parser

The first stage only understands the uploaded Meeting Recap.

It must not write to the database.

Extract meaningful project information into candidates.

Possible candidate types:

-   Objective
-   Requirement
-   User Story
-   Task
-   UAT
-   Deployment
-   Meeting
-   Decision
-   Information
-   Bug
-   Risk
-   Event
-   Milestone
-   Other valid Projectson item types

Example:

``` json
{
  "candidate_id": "CAND-001",
  "type": "Task",
  "content": "Develop Cloud Run /api/v1/gate/verify multimodal verification endpoint",
  "source_reference": {
    "document_id": "...",
    "section": "...",
    "location": "...",
    "excerpt": "..."
  }
}
```

Requirements:

-   Every candidate must have a unique candidate ID.
-   Preserve source evidence.
-   Do not invent facts.
-   Do not assign a Projectson item UID at this stage.

------------------------------------------------------------------------

# 9. Extraction Coverage

After parsing, create a count summary:

``` json
{
  "counts": {
    "objectives": 0,
    "requirements": 0,
    "user_stories": 0,
    "tasks": 0,
    "uats": 0,
    "deployments": 0,
    "decisions": 0,
    "other": 0
  }
}
```

Every candidate must subsequently receive a processing result.

No candidate may silently disappear.

If a candidate is intentionally ignored:

``` json
{
  "candidate_id": "CAND-003",
  "action": "IGNORE",
  "reason": "Informational statement with no actionable project impact."
}
```

------------------------------------------------------------------------

# 10. Stage 2 --- Candidate Normalization

Normalize candidate information before matching it to existing items.

Keep both:

-   original extracted content
-   normalized/canonical representation

Example:

``` json
{
  "candidate_id": "CAND-001",
  "canonical_type": "Task",
  "canonical_content": "Develop Cloud Run multimodal verification API",
  "key_attributes": {
    "technology": "Cloud Run",
    "endpoint": "/api/v1/gate/verify",
    "assignee": "Kevin Lau"
  }
}
```

Normalization must not invent facts.

------------------------------------------------------------------------

# 11. Stage 3 --- Existing Memory Retrieval

For each candidate, retrieve potentially relevant existing items.

Use appropriate retrieval signals:

-   same project
-   same item type
-   same parent/context
-   keyword matching
-   semantic similarity
-   assignee
-   technology/system
-   related requirements
-   related user stories
-   related objectives
-   existing relationships
-   source references

Do not blindly compare every candidate to the entire database if a
narrower retrieval strategy is practical.

The retrieval layer produces possible matches.

The reconciliation layer makes the semantic decision.

------------------------------------------------------------------------

# 12. Stage 4 --- Reconciliation

Every candidate must receive exactly one primary action:

``` text
CREATE
UPDATE
NO_CHANGE
REVIEW_REQUIRED
IGNORE
```

## 12.1 CREATE

Use when no existing item represents the same underlying project
knowledge.

Example:

Meeting: "Develop dual-screen UI."

No relevant existing item exists.

Result:

``` json
{
  "candidate_id": "CAND-002",
  "action": "CREATE",
  "existing_item_uid": null,
  "reason": "No existing item represents this work."
}
```

------------------------------------------------------------------------

## 12.2 UPDATE

Use when the candidate represents an existing item but contains new or
corrected information.

Example:

Existing:

``` text
Develop Cloud Run verification API
```

Meeting:

``` text
Develop Cloud Run /api/v1/gate/verify multimodal verification endpoint by Sep 20.
```

This should normally be UPDATE rather than CREATE.

Example:

``` json
{
  "candidate_id": "CAND-001",
  "action": "UPDATE",
  "existing_item_uid": "TPM-241",
  "changes": {
    "content": "...",
    "due_date": "2026-09-20"
  },
  "reason": "Same underlying task with additional implementation and deadline information."
}
```

------------------------------------------------------------------------

## 12.3 NO_CHANGE

Use when the meeting information is semantically equivalent to existing
memory and adds nothing material.

Example:

Existing:

``` text
Perform load testing for 500 concurrent users.
```

Meeting:

``` text
500 concurrent user load test is required.
```

Result:

``` json
{
  "candidate_id": "CAND-003",
  "action": "NO_CHANGE",
  "existing_item_uid": "TPM-245",
  "reason": "Meeting information is semantically equivalent to existing item."
}
```

Do not create a duplicate.

------------------------------------------------------------------------

## 12.4 REVIEW_REQUIRED

If multiple existing items are plausible matches and automatic selection
is unsafe:

``` json
{
  "candidate_id": "CAND-004",
  "action": "REVIEW_REQUIRED",
  "possible_matches": [
    "TPM-241",
    "TPM-259"
  ],
  "reason": "Multiple existing items are semantically similar and automatic selection is unsafe."
}
```

Never randomly choose an existing item simply to complete the workflow.

------------------------------------------------------------------------

## 12.5 IGNORE

Use only when the extracted content is genuinely irrelevant to
Projectson structured memory.

The system must retain the reason.

------------------------------------------------------------------------

# 13. Matching Must Not Be Text-Only

Do not determine equivalence using string matching alone.

Consider:

1.  Semantic content
2.  Item type
3.  Project
4.  Parent context
5.  Objective
6.  Requirement
7.  User Story
8.  Task purpose
9.  Assignee
10. Technology/system
11. Dates
12. Existing relationships
13. Source evidence

The objective is to determine whether two records represent the same
underlying project knowledge.

------------------------------------------------------------------------

# 14. Duplicate Meeting Upload Protection

There must be two levels of duplicate detection.

## 14.1 Exact Duplicate

When a file is uploaded:

``` text
file
↓
SHA-256
↓
document hash
```

If the same file hash was previously processed:

``` json
{
  "duplicate_status": "EXACT_DUPLICATE",
  "matched_document_id": "DOC-001"
}
```

Do not process the same meeting again.

Do not create duplicate project items.

------------------------------------------------------------------------

## 14.2 Semantic Duplicate

The same meeting may be uploaded with:

-   different filename
-   different file format
-   formatting changes
-   copied text
-   small wording changes

Therefore support semantic duplicate detection where practical:

``` text
document
↓
normalized text
↓
embedding / similarity retrieval
↓
possible previous meetings
↓
LLM confirmation
```

Possible result:

``` json
{
  "duplicate_status": "LIKELY_DUPLICATE",
  "matched_meeting_id": "MTG-001",
  "reason": "Meeting content substantially overlaps with an already processed meeting."
}
```

If uncertain, use REVIEW_REQUIRED.

------------------------------------------------------------------------

# 15. Traceability

Projectson currently uses a multi-level traceability structure:

``` text
Objective
    ↓
Requirement
    ↓
User Story
    ↓
Task
    ↓
UAT
```

Preserve the existing model.

Do not invent another hierarchy.

The AI may construct or update relationships when evidence supports
them.

However:

> Do not force every item to have every hierarchy level.

If the Meeting Recap does not provide sufficient evidence for a
relationship, do not invent it.

------------------------------------------------------------------------

# 16. Relationship Representation

Every proposed relationship should explicitly identify:

``` json
{
  "parent_uid": "...",
  "child_uid": "...",
  "relationship_type": "...",
  "evidence": "..."
}
```

Every relationship must be supported by:

-   meeting evidence, or
-   existing Projectson memory.

Never create a relationship merely because it appears logically
convenient.

------------------------------------------------------------------------

# 17. Traceability Graph Validation

Before generating the final proposal, validate the graph.

Example invalid graph:

``` text
Objective
    ↓
Requirement
    ↓
Task
```

when the existing model requires a User Story between Requirement and
Task.

Or:

``` text
Task
    ↓
NO PARENT
```

The system must detect orphaned or structurally invalid relationships.

Do not send invalid graphs to the proposal UI as executable changes.

------------------------------------------------------------------------

# 18. Coverage Validation

Compare extracted candidates with processed candidates.

Example:

``` text
Extracted Tasks = 3
Processed Tasks = 2
```

This is a failure.

The system must identify:

``` text
CAND-003 was extracted but has no reconciliation result.
```

Then run a bounded repair/reconciliation step.

The final proposal is valid only when every candidate has exactly one
outcome:

-   CREATE
-   UPDATE
-   NO_CHANGE
-   REVIEW_REQUIRED
-   IGNORE

------------------------------------------------------------------------

# 19. Proposal Must Be Separate from Database Write

The AI should never directly mutate the database during analysis.

Required flow:

``` text
Meeting Upload
    ↓
Analysis
    ↓
Reconciliation
    ↓
Proposal
    ↓
Validation
    ↓
Human Review
    ↓
Approval
    ↓
Database Write
```

Suggested proposal structure:

``` json
{
  "creates": [],
  "updates": [],
  "no_changes": [],
  "review_required": [],
  "ignored": [],
  "relationships": [],
  "validation": {
    "status": "PASS",
    "errors": [],
    "warnings": []
  }
}
```

Only validated proposals should be presented as executable.

------------------------------------------------------------------------

# 20. Human Approval UI

The user should be able to understand exactly what will happen.

For UPDATE:

``` text
UPDATE TPM-241

Before:
Develop Cloud Run verification API

After:
Develop Cloud Run /api/v1/gate/verify multimodal verification endpoint

Reason:
Meeting added endpoint and implementation details.
```

For CREATE:

``` text
CREATE NEW TASK

Type: Task
Content: ...
Parent: US-003
Assignee: Kevin Lau
Source: Meeting Recap / Section 4
```

For REVIEW_REQUIRED:

``` text
AMBIGUOUS MATCH

Candidate:
Develop verification API

Possible existing items:
TPM-241
TPM-259

Reason:
Both are semantically similar.

Please choose.
```

------------------------------------------------------------------------

# 21. Source Traceability

Every AI-generated change should retain source information whenever
possible:

-   source document
-   source meeting
-   source section
-   source excerpt
-   candidate_id

This allows future AI calls to understand where structured project
memory originated.

Recommended conceptual chain:

``` text
Meeting Recap
    ↓
Source Evidence
    ↓
Structured Item
    ↓
Decision / Relation
    ↓
Action
    ↓
Outcome
```

------------------------------------------------------------------------

# 22. Validation Rules

Implement explicit validation rules.

### R001

Every candidate has a unique candidate_id.

### R002

Every candidate has exactly one action.

### R003

Every UPDATE references an existing item.

### R004

Every CREATE contains a complete item payload.

### R005

Every relationship references valid parent and child records.

### R006

No duplicate item is created when NO_CHANGE is appropriate.

### R007

No duplicate item is created when UPDATE is appropriate.

### R008

No candidate is silently dropped.

### R009

No unsupported relationship is invented.

### R010

No unsupported information is invented.

### R011

Traceability graph is structurally valid.

### R012

Proposal conforms to the existing Projectson JSON schema.

### R013

All REVIEW_REQUIRED cases are explicitly surfaced.

### R014

Validation occurs before proposal rendering.

------------------------------------------------------------------------

# 23. Repair Loop

If validation fails:

1.  Identify the validation error.
2.  Identify the affected candidate/item/relationship.
3.  Send only the affected context back to the appropriate reasoning
    step.
4.  Repair.
5.  Validate again.

Example:

``` text
Validation failure:
TASK-003 has no parent User Story.

Repair:
Search relevant existing/candidate User Stories.
Reconcile relationship.
Validate again.
```

Use a bounded repair loop.

Recommended maximum: 3 attempts.

If still invalid:

``` text
REVIEW_REQUIRED
```

with the validation error surfaced to the user.

Do not allow infinite agent loops.

------------------------------------------------------------------------

# 24. Determinism and Structured Output

For structured workflows:

-   Use structured JSON output.
-   Use explicit enums.
-   Use schema validation.
-   Use low temperature where supported.
-   Avoid free-form prose as the internal contract.
-   Separate analysis from execution.
-   Validate every stage.

Do not rely on vague instructions such as:

"Please be careful."

Use explicit rules and validators.

------------------------------------------------------------------------

# 25. Existing Simple Copilot Workflows

Do not route every Copilot request through Meeting Intelligence.

Examples:

``` text
"Create a Task: Build login API"
```

can use the existing direct command workflow.

``` text
"Change TPM-241 to In Progress"
```

can use the existing direct mutation workflow.

Use the Meeting Intelligence pipeline when the user provides:

-   Meeting Recap
-   meeting transcript
-   meeting notes
-   multi-item project information
-   other unstructured/semi-structured project documents

The system should route the request to the appropriate workflow.

------------------------------------------------------------------------

# 26. Recommended Regression Test Suite

Build regression tests for at least:

## TEST 01 --- One New Task

Meeting contains one new Task.

Expected:

``` text
CREATE 1 Task
```

------------------------------------------------------------------------

## TEST 02 --- Multiple New Tasks

Meeting contains two or three Tasks.

Expected:

All extracted Tasks receive a result.

No candidate disappears.

------------------------------------------------------------------------

## TEST 03 --- Existing Task With New Information

Existing:

``` text
Develop Cloud Run verification API
```

Meeting:

``` text
Develop Cloud Run /api/v1/gate/verify multimodal endpoint by Sep 20.
```

Expected:

``` text
UPDATE existing task
```

Not CREATE.

------------------------------------------------------------------------

## TEST 04 --- Existing Information With No Change

Expected:

``` text
NO_CHANGE
```

------------------------------------------------------------------------

## TEST 05 --- Exact Same File Uploaded Twice

Expected:

``` text
EXACT_DUPLICATE
```

No duplicate items.

------------------------------------------------------------------------

## TEST 06 --- Same Meeting, Different Filename

Expected:

Semantic duplicate detection where supported.

------------------------------------------------------------------------

## TEST 07 --- Full Traceability

Meeting provides:

``` text
Objective
→ Requirement
→ User Story
→ Task
→ UAT
```

Expected:

Correct multi-level traceability.

------------------------------------------------------------------------

## TEST 08 --- Missing Intermediate Level

Meeting provides Task but does not clearly establish User Story.

Expected:

Do not invent a User Story.

------------------------------------------------------------------------

## TEST 09 --- Ambiguous Match

Two existing Tasks are plausible matches.

Expected:

``` text
REVIEW_REQUIRED
```

------------------------------------------------------------------------

## TEST 10 --- Candidate Coverage Failure

Parser extracts 3 Tasks but planner processes only 2.

Expected:

Validation failure + repair.

------------------------------------------------------------------------

## TEST 11 --- Invalid Relationship

A Task is assigned to an invalid parent.

Expected:

Graph validation failure.

------------------------------------------------------------------------

## TEST 12 --- Mixed Changes

Meeting contains:

-   new Task
-   updated Task
-   unchanged Task

Expected:

Correct mixture of:

``` text
CREATE
UPDATE
NO_CHANGE
```

------------------------------------------------------------------------

## TEST 13 --- Decision Only

Meeting contains a project Decision but no Task.

Expected:

Create/update Decision only when supported by the existing Projectson
model.

------------------------------------------------------------------------

## TEST 14 --- Irrelevant Information

Meeting contains information that has no project-memory value.

Expected:

``` text
IGNORE
```

with reason.

------------------------------------------------------------------------

# 27. Acceptance Criteria

The implementation is successful when:

1.  Existing direct Copilot commands continue working.
2.  Meeting Recaps can be processed without item codes.
3.  Natural-language content becomes candidate items.
4.  Candidates can be reconciled against existing project memory.
5.  Existing items can be correctly updated.
6.  Duplicate information can produce NO_CHANGE.
7.  New information can produce CREATE.
8.  Ambiguous cases become REVIEW_REQUIRED.
9.  Traceability relationships remain valid.
10. Multi-level traceability can be represented correctly.
11. Extracted candidates cannot silently disappear.
12. Duplicate Meeting Recaps do not create duplicate project memory.
13. Proposals pass validation before being shown as executable.
14. Human approval remains the final database-write gate.
15. AI-generated changes retain source traceability where possible.

------------------------------------------------------------------------

# 28. Implementation Sequence

Implement incrementally.

## Phase 1 --- Discovery

Inspect the current codebase and report:

-   current architecture
-   current Copilot flow
-   current DB schema
-   current relationship model
-   current proposal flow
-   current Meeting upload flow
-   current failure points

Do not modify code yet.

------------------------------------------------------------------------

## Phase 2 --- Design

Propose the smallest required architecture changes.

Clearly identify:

-   reusable existing components
-   new components
-   database changes
-   API changes
-   UI changes
-   validation changes
-   test changes

Do not rewrite working functionality unnecessarily.

------------------------------------------------------------------------

## Phase 3 --- Candidate Extraction

Implement:

``` text
Meeting
→ Parser
→ Candidate Items
→ Coverage Summary
```

Test extraction independently.

------------------------------------------------------------------------

## Phase 4 --- Reconciliation

Implement:

``` text
Candidate
→ Existing Memory Retrieval
→ CREATE / UPDATE / NO_CHANGE / REVIEW_REQUIRED / IGNORE
```

Test this independently.

------------------------------------------------------------------------

## Phase 5 --- Traceability

Implement / improve:

``` text
Candidate Items
→ Parent / Child Planning
→ Relationship Validation
```

------------------------------------------------------------------------

## Phase 6 --- Proposal Validation

Implement:

``` text
Proposal
→ Coverage Validation
→ Business Rule Validation
→ Graph Validation
→ JSON Schema Validation
```

------------------------------------------------------------------------

## Phase 7 --- Approval + DB Write

Connect validated proposals to the existing human approval flow.

Only approved proposals may mutate the database.

------------------------------------------------------------------------

## Phase 8 --- Duplicate Protection

Implement:

-   exact file hash detection
-   semantic duplicate meeting detection where practical

------------------------------------------------------------------------

## Phase 9 --- Regression Testing

Run the complete regression suite.

Do not declare the feature complete simply because one example works.

------------------------------------------------------------------------

# 29. Important Engineering Principle

Do not solve reliability problems by endlessly expanding the system
prompt.

Use:

``` text
LLM reasoning
+
Structured intermediate states
+
Application-level validation
+
Database constraints
+
Regression tests
```

The prompt tells the model how to reason.

The application code enforces what must be true.

The database enforces what must never be invalid.

The regression suite proves the workflow remains stable.

------------------------------------------------------------------------

# 30. Final Product Principle

Projectson's AI Copilot should behave as a:

> **Structured AI Memory Reconciliation Engine**

not simply a:

> **Text Generator**

The key question after reading a Meeting Recap is always:

> "Does this information represent something new, a change to existing
> memory, information Projectson already knows, or an ambiguous case?"

Only after answering that question should Projectson propose changes.

Human approval remains the final gate before database mutation.

------------------------------------------------------------------------

# 31. First Task for Antigravity

When this specification is provided, DO NOT immediately modify the
codebase.

First respond with:

1.  Current architecture discovered.
2.  Current Copilot workflow discovered.
3.  Current database/relationship model discovered.
4.  Current Meeting Recap workflow discovered.
5.  Current failure points discovered.
6.  Gap analysis against this specification.
7.  Proposed minimal implementation plan.
8.  Files/modules that would be changed.
9.  Database migrations, if any.
10. Regression tests to be added.

Wait for implementation approval before making major architectural
changes.
