# Using Superpowers Skills with Aarya Orchestrator

## Quick Start

When requesting features or fixes, the system automatically uses the appropriate skills and subagents. Here's how to get the most out of them:

## Feature Development Workflow

### Example 1: "Add a Wishlist Feature"

```
You: "Add a wishlist feature where users can save products"

System automatically:
1. ✅ Triggers aarya-brainstorming
   - Asks clarifying questions
   - Presents design options
   - Creates implementation plan

2. ✅ After approval, triggers aarya-using-git-worktrees
   - Creates isolated branch: feature/wishlist

3. ✅ Triggers aarya-subagent-driven-development
   Dispatches in parallel:
   - Database task (wishlist table)
   - Backend API task (wishlist endpoints)
   - Frontend task (wishlist UI components)

4. ✅ Each subagent uses aarya-test-driven-development
   - Writes failing tests first
   - Implements minimal code
   - Makes tests pass

5. ✅ Triggers aarya-verification-before-completion
   - Runs all tests
   - Manual testing
   - Log verification
   - Database integrity

6. ✅ Triggers aarya-requesting-code-review
   - Stage 1: Spec compliance
   - Stage 2: Code quality

7. ✅ Triggers aarya-finishing-a-development-branch
   - Merge to main
   - Cleanup worktree
```

### Example 2: "Fix Payment Transaction Bug"

```
You: "6 orders have no payment records, investigate and fix"

System automatically:
1. ✅ Triggers aarya-systematic-debugging
   Phase 1: Reproduce (query database, check logs)
   Phase 2: Isolate (read code, find root cause)
   Phase 3: Fix (implement solution with tests)
   Phase 4: Verify (test end-to-end)

2. ✅ Uses aarya-test-driven-development
   - Write test for payment transaction creation
   - Implement fix
   - Verify test passes

3. ✅ Uses aarya-verification-before-completion
   - Run all tests
   - Create test order
   - Verify payment record created
   - Check logs for errors
```

## Trigger Phrases

These phrases automatically trigger the right skills:

| Phrase | Skill Triggered |
|--------|----------------|
| "add a feature", "implement X" | aarya-brainstorming → aarya-subagent-driven-development |
| "fix this bug", "debug X" | aarya-systematic-debugging |
| "write tests", "test this" | aarya-test-driven-development |
| "how should we", "what's the best approach" | aarya-brainstorming |
| "review this code", "check this PR" | aarya-requesting-code-review |
| "I'm done", "complete this task" | aarya-verification-before-completion → aarya-finishing-a-development-branch |
| "plan this out", "let's design" | aarya-brainstorming |

## Subagent Dispatch Examples

### Parallel Dispatch (Independent Tasks)

```javascript
// System automatically dispatches these in parallel:

Task("Create wishlist database table:
- id, user_id, product_id, created_at
- Foreign keys with CASCADE delete
- Unique constraint on (user_id, product_id)
File: migrations/add_wishlist_table.sql")

Task("Create wishlist API endpoints:
- GET /api/v1/wishlist (user's wishlist)
- POST /api/v1/wishlist/:product_id (add)
- DELETE /api/v1/wishlist/:product_id (remove)
- POST /api/v1/wishlist/:product_id/check (check if in wishlist)
Files: services/commerce/routes/wishlist.py, services/commerce/service/wishlist_service.py")

Task("Build wishlist UI components:
- WishlistButton (add/remove toggle)
- WishlistPage (list of saved products)
- WishlistCount badge in header
Files: frontend_new/components/wishlist/WishlistButton.jsx, etc.")
```

### Sequential Dispatch (Dependent Tasks)

```javascript
// These must run in order (each depends on previous):

// Step 1: Research
Task("Investigate why homepage loads slowly:
1. Check bundle size
2. Check API calls
3. Check image optimization
4. Check for unnecessary re-renders
Return: Performance bottleneck analysis")

// Step 2: Implement (after analysis complete)
Task("Optimize homepage based on analysis:
1. Implement code splitting for heavy components
2. Add image lazy loading
3. Reduce API calls
4. Memoize expensive components
Return: Summary of optimizations and performance improvements")

// Step 3: Verify
Task("Verify homepage performance improvements:
1. Run Lighthouse audit
2. Check bundle size
3. Verify all tests pass
4. Manual testing
Return: Before/after metrics")
```

## Real-World Scenarios

### Scenario 1: Complex Feature (Multi-Step Checkout)

```
You: "Make checkout multi-step: cart → address → payment → confirmation"

Orchestrator workflow:
1. aarya-brainstorming: Design checkout flow with steps
2. aarya-using-git-worktrees: Create feature/multi-step-checkout
3. aarya-subagent-driven-development:
   - Subagent 1: Address form component
   - Subagent 2: Payment selection component
   - Subagent 3: Order confirmation component
   - Subagent 4: State management between steps
4. Each subagent uses aarya-test-driven-development
5. aarya-verification-before-completion: Test full checkout flow
6. aarya-requesting-code-review: Verify UX and code quality
7. aarya-finishing-a-development-branch: Merge and cleanup
```

### Scenario 2: Production Incident

```
You: "Users can't complete payments, Razorpay returning errors"

Orchestrator workflow:
1. aarya-systematic-debugging:
   - Phase 1: Reproduce (test payment in dev)
   - Phase 2: Isolate (check Razorpay logs, credentials, webhooks)
   - Phase 3: Fix (implement solution)
   - Phase 4: Verify (test payment end-to-end)
2. aarya-test-driven-development: Add regression test
3. aarya-verification-before-completion: Verify no new errors
4. Deploy fix to production
```

### Scenario 3: Performance Optimization

```
You: "Product pages load slowly, optimize them"

Orchestrator workflow:
1. aarya-systematic-debugging: Profile current performance
2. aarya-brainstorming: Present optimization strategies
3. After approval, aarya-subagent-driven-development:
   - Subagent 1: Image optimization (Next.js Image, WebP)
   - Subagent 2: Component memoization (React.memo, useMemo)
   - Subagent 3: API response caching (Redis)
   - Subagent 4: Code splitting (dynamic imports)
4. aarya-verification-before-completion: Lighthouse audit before/after
5. aarya-requesting-code-review: Ensure no functionality broken
6. Merge optimizations
```

## Tips for Best Results

### ✅ DO:
- Be specific about what you want
- Let the system ask clarifying questions
- Approve designs before implementation
- Run verification before marking complete
- Use subagents for complex, multi-part tasks

### ❌ DON'T:
- Skip the brainstorming phase for complex features
- Work directly on main branch
- Mark tasks complete without verification
- Dispatch dependent tasks in parallel
- Merge without code review

## Monitoring Skill Usage

Track which skills are being used:

```bash
# Check recent skill triggers
grep "SKILL TRIGGERED" .qwen/logs/orchestrator.log | tail -20

# Check subagent executions
grep "SUBAGENT DISPATCHED" .qwen/logs/orchestrator.log | tail -20

# Check verification results
grep "VERIFICATION COMPLETE" .qwen/logs/orchestrator.log | tail -20
```

## Customizing Skills

Edit skill files in `.qwen/skills/<skill-name>/SKILL.md` to:
- Add project-specific examples
- Update commands for your setup
- Add new trigger phrases
- Include common failure patterns

See [SKILL.md format guide](README.md#skill-format) for details.
