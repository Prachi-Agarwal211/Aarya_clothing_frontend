# Aarya Superpowers Skills - Quick Reference Card

## 🎯 Available Skills (8 Total)

| Icon | Skill | Auto-Triggers On |
|------|-------|------------------|
| 🧪 | **aarya-test-driven-development** | Any code implementation |
| 🐛 | **aarya-systematic-debugging** | Bug reports, errors, incidents |
| 🤖 | **aarya-subagent-driven-development** | Multi-part tasks |
| 💡 | **aarya-brainstorming** | Feature planning, design questions |
| 🌳 | **aarya-using-git-worktrees** | Code changes |
| 👀 | **aarya-requesting-code-review** | Completed implementations |
| ✅ | **aarya-verification-before-completion** | Task completion |
| 🏁 | **aarya-finishing-a-development-branch** | Branch completion |

## 🚀 Available Subagents (4 Total)

| Agent | Specialty | Use For |
|-------|-----------|---------|
| **aarya-orchestrator** | Full-stack coordination | End-to-end features |
| **frontend-specialist** | Next.js/React | UI, performance, UX |
| **lead-architect** | Architecture/review | Design validation |
| **qa-engineer** | Testing/quality | Test execution |

## ⚡ Common Requests & What Happens

```
"Add wishlist feature"
  → 💡 Brainstorm → 🌳 Worktree → 🤖 Subagents → 🧪 TDD → ✅ Verify → 👀 Review → 🏁 Finish

"Fix payment bug"
  → 🐛 Debug → 🧪 TDD → ✅ Verify → 🏁 Finish

"How should we implement coupons?"
  → 💡 Brainstorm → Design options → Plan → Approve

"Review this PR"
  → 👀 Review (Stage 1: Spec) → 👀 Review (Stage 2: Quality) → Approve/Block

"I'm done with the feature"
  → ✅ Verify → 🏁 Finish
```

## 📁 File Locations

```
/opt/Aarya_clothing_frontend/
├── .qwen/
│   ├── skills/                          ← Skills directory
│   │   ├── README.md                    ← Skills documentation
│   │   ├── aarya-brainstorming/
│   │   │   └── SKILL.md
│   │   ├── aarya-finishing-a-development-branch/
│   │   │   └── SKILL.md
│   │   ├── aarya-requesting-code-review/
│   │   │   └── SKILL.md
│   │   ├── aarya-subagent-driven-development/
│   │   │   └── SKILL.md
│   │   ├── aarya-systematic-debugging/
│   │   │   └── SKILL.md
│   │   ├── aarya-test-driven-development/
│   │   │   └── SKILL.md
│   │   ├── aarya-using-git-worktrees/
│   │   │   └── SKILL.md
│   │   └── aarya-verification-before-completion/
│   │       └── SKILL.md
│   └── SUPERPOWERS_USAGE_GUIDE.md      ← Usage guide
└── docs/
    └── DOCUMENTATION_CLEANUP_REPORT.md  ← Docs cleanup report
```

## 🎓 Learning Path

### Week 1: Basics
1. Use **aarya-brainstorming** for all feature requests
2. Use **aarya-systematic-debugging** for all bugs
3. Always verify with **aarya-verification-before-completion**

### Week 2: Intermediate
4. Start using **aarya-test-driven-development** consistently
5. Use **aarya-using-git-worktrees** for all changes
6. Run **aarya-requesting-code-review** before merging

### Week 3: Advanced
7. Use **aarya-subagent-driven-development** for complex tasks
8. Finish with **aarya-finishing-a-development-branch**
9. Dispatch subagents in parallel for speed

## 🔧 Customization

To customize a skill, edit its SKILL.md file:

```bash
# Example: Add project-specific examples to TDD skill
nano .qwen/skills/aarya-test-driven-development/SKILL.md

# Add new trigger phrases in the frontmatter:
description: Use when... (add your trigger phrases here)
```

## 📊 Metrics to Track

```bash
# Skill usage (weekly)
grep -r "SKILL TRIGGERED" .qwen/logs/ | wc -l

# Subagent dispatches (weekly)
grep -r "SUBAGENT DISPATCHED" .qwen/logs/ | wc -l

# Verification pass rate
grep -r "VERIFICATION COMPLETE" .qwen/logs/ | wc -l
```

## 💡 Pro Tips

1. **Let skills guide you** - Don't skip steps, they exist for a reason
2. **Be specific in requests** - Better inputs → better outputs
3. **Use parallel dispatch** - Independent tasks = faster development
4. **Always verify** - Never trust "works on my machine"
5. **Review before merging** - Catch issues before they hit production

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Skill not triggering | Add more trigger phrases to SKILL.md description |
| Wrong skill triggered | Make request more specific, use explicit phrases |
| Subagent fails | Check agent configuration in .qwen/ |
| Skill guidance unclear | Edit SKILL.md with better examples |

---

**Based on:** [obra/superpowers](https://github.com/obra/superpowers)  
**Customized for:** Aarya Clothing E-commerce Platform  
**Created:** April 8, 2026
