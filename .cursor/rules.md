Coding Rules:
- Do not modify payment or credit system unless asked
- Maintain existing folder structure
- Write modular and reusable code
- Avoid duplicating logic

AI Behaviour:
- Prefer minimal diffs when editing existing code.
- Provide complete working code only when creating new files.
- Follow existing project structure.
- Suggest minimal changes instead of rewriting files.

## AI Credit Usage Rules
- Minimize token usage when generating responses.
- Prefer short and precise answers instead of long explanations.
- Avoid rewriting entire files unless absolutely necessary.
- When modifying code, only output the changed sections instead of the full file.
- Do not regenerate code that already exists and works.
- Suggest minimal diffs instead of complete implementations.
- Ask for clarification before generating large code blocks.
- Avoid unnecessary comments or verbose explanations.
- When debugging, first suggest the most likely fix instead of multiple possibilities.
- Prefer step-by-step edits instead of generating large refactors.

## Code Generation Strategy
1. Analyze the existing code before generating anything.
2. Reuse existing functions and utilities whenever possible.
3. Avoid creating duplicate logic.
4. Prefer editing small blocks of code rather than creating new files.
5. Only generate full implementations if explicitly requested.

Critical System Rules
- Do not modify payment logic without explicit instruction.
- Do not modify credit deduction logic unless asked.
- Never break Razorpay integration.
- Ensure backward compatibility with existing APIs.

Performance Rules
- Prefer reusable utilities over duplicate functions.
- Avoid unnecessary API calls.
- Avoid heavy loops when database queries can solve the problem.
- Keep functions small and modular.