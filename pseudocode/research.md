# Research: Pseudocode Terms For SACE

## Scope

This note was researched on 2026-04-03 against current SACE and Australian Curriculum sources. It is aimed at terminology that is suitable for:

- SACE Digital Technologies
- SACE Information Processing and Publishing

As of 2026-04-03, the SACE website shows Digital Technologies in Subject Renewal Group 3 and Information Processing and Publishing in Group 2. That means exact future wording may change, but the current vocabulary below is aligned to the terminology now used by SACE and ACARA.

## What SACE Seems To Expect

Current SACE pages show that:

- Digital Technologies focuses on practical and innovative solutions, data sets, modelling, and sustainable solutions.
- Information Processing and Publishing focuses on designing and implementing information processing solutions and communicating information effectively.

Inference: for SACE use, the safest pseudocode vocabulary is the set of terms that supports algorithm design, data handling, input-process-output thinking, testing, and clear communication.

## What "Pseudocode" Means In This Context

ACARA material describes pseudocode as English language statements that explain the steps in an algorithm clearly and without tying the writer to one specific programming language. It is closely related to structured English and is often paired with flowcharts.

Important practical point:

- SACE does not appear to prescribe one single mandatory pseudocode syntax.
- Consistency matters more than choosing one exact keyword set.
- Students should use one clear style and stay consistent throughout a task.

## Recommended Core Term Set

The table below covers the core terms most likely to be useful in SACE-suitable pseudocode work. Some terms are directly defined in official sources. Others are marked as inferred where the curriculum uses the term but does not lock it to one exact wording.

| Term | Meaning for students | Status |
|---|---|---|
| algorithm | A step-by-step method for solving a problem. | Directly supported |
| abstraction | Hiding unnecessary detail so the important parts are easier to work with. | Directly supported |
| decomposition | Breaking a larger problem into smaller parts. | Supported by computational thinking materials |
| specification | A precise statement of what the solution must do and what constraints apply. | Directly supported |
| implementation | Turning an algorithm into an automated solution, usually by programming. | Directly supported |
| data | Information represented in a form digital systems can store, process and communicate. | Directly supported |
| binary | Representing data using two states, usually 0 and 1. | Directly supported |
| digital system | Hardware and software working together to transform data into a digital solution. | Directly supported |
| digital solution | A created solution that uses digital systems to meet a need or solve a problem. | Directly supported in curriculum structure |
| model | A simplified representation used to explain or test an idea or system. | Directly supported |
| user story | A short statement of user need that helps define the problem. | Directly supported |
| design criteria | The measures used to judge whether a solution is successful. | Directly supported |
| trace | Step through an algorithm to predict output for a given input. | Directly supported |
| desk checking | Manually checking an algorithm with sample inputs to test its logic. | Directly supported |
| test case | A chosen input and expected result used to validate an algorithm or program. | Directly supported |
| debug | Find and fix faults in a program or algorithm. | Directly supported by curriculum wording |
| variable | A named place that stores data that can change while a program runs. | Directly supported |
| function | A reusable part of a program, often returning a value. | Supported by curriculum wording |
| modular program | A program built from smaller parts or modules. | Directly supported |
| data structure | A way of organizing data so algorithms can use it effectively. | Directly supported |
| general-purpose programming language | A text-based language designed to solve a wide range of problems. | Directly supported |
| visual programming | A programming style where blocks or graphical elements represent instructions. | Directly supported |
| flowchart | A diagrammatic representation of an algorithm. | Directly supported |

## Control Flow Terms

These are the control ideas students most often need when writing pseudocode.

| Term | Meaning for students | Typical pseudocode words |
|---|---|---|
| sequence | Instructions run in order, one after another. | START, step 1, step 2, END |
| input | Data entering the algorithm or program. | INPUT, READ |
| output | Data or messages produced by the algorithm or program. | OUTPUT, DISPLAY, PRINT |
| process | A calculation or action carried out on data. | SET, CALCULATE, ASSIGN |
| branching | Choosing between alternatives based on a condition. | IF, THEN, ELSE |
| selection | Another name for branching or decision-making. | IF, ELSE, CASE |
| comparison operator | A symbol or word used to compare values. | =, <, >, <=, >=, <> |
| logical operator | A word used to combine or reverse conditions. | AND, OR, NOT |
| iteration | Repeating steps until a condition changes. | WHILE, REPEAT, UNTIL, FOR |
| repetition | Another common word for iteration. | WHILE, FOR, REPEAT |
| nested control structures | A control structure placed inside another one. | IF inside WHILE, loop inside loop |
| function call | Running a named function. | CALL, functionName(...) |
| return value | The result produced by a function. | RETURN |

## Common Pseudocode Keywords And Conventions

These command words are suitable for school pseudocode. Some are explicitly shown in ACARA elaborations. Others are inferred from standard classroom pseudocode conventions that fit the curriculum wording.

### Program boundaries

- `START`: begin the algorithm
- `END`: finish the algorithm

### Input and output

- `INPUT value`
- `READ value`
- `OUTPUT result`
- `DISPLAY message`
- `PRINT result`

### Assignment and calculation

- `SET total = 0`
- `total <- total + mark`
- `CALCULATE average = total / count`

Note: `SET` and `<-` are both common. Pick one style and stay consistent.

### Decisions

- `IF condition THEN`
- `ELSE`
- `ELSE IF`
- `ENDIF`
- `CASE OF`
- `OTHERWISE`
- `ENDCASE`

### Loops

- `FOR i = 1 TO 10`
- `NEXT i`
- `WHILE condition`
- `ENDWHILE`
- `REPEAT`
- `UNTIL condition`

### Reuse and structure

- `FUNCTION name(parameters)`
- `RETURN value`
- `ENDFUNCTION`
- `PROCEDURE name(parameters)`
- `CALL procedureName`
- `ENDPROCEDURE`

### Boolean values and logic

- `TRUE`
- `FALSE`
- `AND`
- `OR`
- `NOT`

### Arithmetic and comparison

- `+`, `-`, `*`, `/`
- `DIV` for integer division
- `MOD` for remainder
- `=`, `<`, `>`, `<=`, `>=`, `<>`

### Data containers

- `ARRAY`
- `LIST`
- `INDEX`
- `ITEM`
- `RECORD`

Inference: `ARRAY`, `LIST`, `RECORD`, `DIV`, and `MOD` are standard classroom pseudocode terms and fit Digital Technologies work, but they are not all explicitly prescribed on the SACE pages reviewed.

## Terms Most Worth Teaching First

If the goal is a practical SACE glossary rather than a full programming reference, these are the highest-priority terms to teach first:

1. algorithm
2. input
3. output
4. process
5. variable
6. sequence
7. selection
8. branching
9. iteration
10. condition
11. comparison operator
12. logical operator
13. function
14. trace
15. desk checking
16. test case
17. debug
18. abstraction
19. decomposition
20. specification

## Suggested Classroom Pseudocode Style

For SACE-aligned work, this style is the safest:

- Use plain English-like statements.
- Use indentation to show structure.
- Declare or introduce variables clearly.
- Show input, processing, and output explicitly.
- Use `IF`, `ELSE`, `WHILE`, `FOR`, `REPEAT`, `FUNCTION`, and `RETURN` consistently.
- Trace algorithms with sample inputs before coding.
- Validate logic with test cases.

## Example Of A SACE-Suitable Style

```text
START
INPUT score
IF score >= 50 THEN
    OUTPUT "Pass"
ELSE
    OUTPUT "Needs improvement"
ENDIF
END
```

## Practical Conclusion

The most reliable interpretation is:

- SACE-suitable pseudocode should be clear, structured, language-neutral, and easy to translate into code.
- The curriculum strongly supports algorithm, abstraction, specification, implementation, tracing, testing, variables, functions, and control structures.
- Exact keyword choice can vary slightly between teachers, but the underlying concepts should remain stable.

## Sources

- SACE Digital Technologies overview: https://www.sace.sa.edu.au/web/digital-technologies
- SACE Information Processing and Publishing overview: https://www.sace.sa.edu.au/web/information-processing-and-publishing
- SACE Subject Renewal roadmap: https://www.sace.sa.edu.au/en-US/innovating/subject-renewal/subject-renewal-roadmap
- SACE Digital Technologies subject renewal page: https://www.sace.sa.edu.au/web/digital-technologies/subject-renewal
- ACARA Digital Technologies structure v8.4: https://v8.australiancurriculum.edu.au/f-10-curriculum/technologies/digital-technologies/structure/
- ACARA Digital Technologies key ideas and concepts v8.4: https://v8.australiancurriculum.edu.au/resources/digital-technologies-in-focus/resources/v84-resources/key-ideas-and-concepts/
- ACARA Technologies glossary v8.4: https://v8.australiancurriculum.edu.au/f-10-curriculum/technologies/glossary/
- ACARA Years 5-6 classroom ideas glossary: https://v9.australiancurriculum.edu.au/content/dam/en/curriculum/ac-version-9/downloads/digital-technologies-in-focus/resources/teaching/programming-and-algorithms/classroom_ideas_5-6_microbit_environmental_measurement.pdf
- ACARA Years 5-8 classroom ideas glossary: https://v9.australiancurriculum.edu.au/content/dam/en/curriculum/ac-version-9/downloads/digital-technologies-in-focus/resources/teaching/programming-and-algorithms/classroom_ideas_5-8_microbit_environmental_measurement.pdf
- ACARA Digital Technologies sequence of content v9.0: https://v9.australiancurriculum.edu.au/content/dam/en/curriculum/ac-version-9/downloads/digital-technologies-in-focus/resources/planning/v9-f-10-sequence-of-content-digital-technologies.pdf

## Notes On Confidence

- High confidence: algorithm, abstraction, specification, implementation, data, binary, digital system, pseudocode, variables, user stories, test cases, control structures.
- Medium confidence: exact preferred school keyword set for pseudocode commands, because official sources describe the concepts clearly but do not enforce one single syntax.
