# Aarya Superpowers Skills

Custom skills framework for the Aarya Clothing e-commerce project, inspired by [obra/superpowers](https://github.com/obra/superpowers).

## Overview

These skills provide structured workflows and best practices tailored for the Aarya Clothing microservices architecture. Each skill is automatically triggered based on context and user intent.

## Available Skills

| Skill | Triggers When | Purpose |
|-------|---------------|---------|
| **[aarya-test-driven-development](aarya-test-driven-development/SKILL.md)** | Implementing any feature or fix | Enforces strict TDD: test → code → verify |
| **[aarya-systematic-debugging](aarya-systematic-debugging/SKILL.md)** | Debugging any issue | 4-phase process: reproduce → isolate → fix → verify |
| **[aarya-subagent-driven-development](aarya-subagent-driven-development/SKILL.md)** | Complex multi-part tasks | Dispatch isolated subagents for parallel execution |
| **[aarya-brainstorming](aarya-brainstorming/SKILL.md)** | Planning features/architecture | Socratic questioning → design → plan → approve |
| **[aarya-using-git-worktrees](aarya-using-git-worktrees/SKILL.md)** | Any code changes | Isolated development branches for safe development |
| **[aarya-requesting-code-review](aarya-requesting-code-review/SKILL.md)** | Completing implementations | Two-stage review: spec compliance → code quality |
| **[aarya-verification-before-completion](aarya-verification-before-completion/SKILL.md)** | Marking tasks complete | Mandatory verification checklist |
| **[aarya-finishing-a-development-branch](aarya-finishing-a-development-branch/SKILL.md)** | Completing branch work | Verify, merge, cleanup workflow |

## How It Works

### Automatic Triggering

Skills are triggered automatically based on your requests:

```
"add a coupon system" → aarya-brainstorming
"fix the payment bug" → aarya-systematic-debugging
"implement the product reviews" → aarya-subagent-driven-development
"write tests for the order service" → aarya-test-driven-development
"review this PR" → aarya-requesting-code-review
"I'm done with the feature" → aarya-verification-before-completion
```

### Workflow Integration

```
1. BRAINSTORM → Design the feature, get approval
2. WORKTREE → Create isolated development branch
3. SUBAGENTS → Dispatch parallel tasks
4. TDD → Write tests first, then code
5. VERIFY → Comprehensive verification
6. REVIEW → Two-stage code review
7. FINISH → Merge and cleanup
```

## Available Subagents

In addition to skills, specialized subagents handle specific domains:

| Subagent | Domain | Use For |
|----------|--------|---------|
| **aarya-orchestrator** | Full-stack features | End-to-end feature development |
| **frontend-specialist** | Next.js/React | UI components, performance, UX |
| **lead-architect** | Code review/architecture | Design validation, code quality |
| **qa-engineer** | Testing/quality | Test execution, regression prevention |

## Skill Format

Each skill is a Markdown file with:

```markdown
---
name: skill-name
description: Use when [specific triggering conditions]
---

# Skill Name

## Overview
## When to Use
## Core Pattern
## Quick Reference
## Implementation
## Common Mistakes
## Real-World Impact
```

## Creating Custom Skills

1. Create directory: `skills/your-skill-name/`
2. Add `SKILL.md` with required frontmatter
3. Follow the format in [SKILL.md template](SKILL_TEMPLATE.md)
4. Test by triggering the skill manually

## Best Practices

- **Be specific in triggers** - Use exact symptoms, not vague descriptions
- **Keep skills focused** - One skill, one purpose
- **Include examples** - Real code from the Aarya project
- **Update regularly** - Skills should evolve with the project
- **Don't summarize workflow in description** - Agents will skip reading the full skill

## Integration with aarya-orchestrator

The `aarya-orchestrator` agent can utilize these skills to:

1. **Decompose complex features** into subagent tasks
2. **Enforce TDD** across all implementations
3. **Coordinate parallel development** with isolated contexts
4. **Ensure quality** through systematic verification and review

Example orchestrator workflow:

```
User: "Add a wishlist feature"

Orchestrator:
1. Invoke aarya-brainstorming → Design wishlist
2. Create worktree → feature/wishlist
3. Dispatch subagents in parallel:
   - Database schema task
   - Backend API task
   - Frontend UI task
4. Each subagent uses aarya-test-driven-development
5. Integrate results, run aarya-requesting-code-review
6. Execute aarya-verification-before-completion
7. Run aarya-finishing-a-development-branch
```

## Troubleshooting

### Skill Not Triggering

- Check if description matches your request keywords
- Add more trigger synonyms to the frontmatter description
- Use explicit trigger phrases: "let's plan this", "debug this issue"

### Skill Not Helpful

- Skills provide guidance, not automatic implementation
- Use skills as reference during development
- Update skills if guidance is outdated

### Subagent Not Available

- Check `.qwen/` configuration for agent definitions
- Ensure agent has necessary permissions and context

## Credits

Based on the [Superpowers skills framework](https://github.com/obra/superpowers) by obra.
Customized for Aarya Clothing e-commerce platform.
