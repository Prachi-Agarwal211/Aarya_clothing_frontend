# Product Upload & Visibility Issues - Action Plan

**Created:** 2026-03-26  
**Priority:** CRITICAL  
**Status:** Ready to Implement  

---

## Problem Summary

Admin users cannot successfully upload/update products, and products are not appearing on customer-facing pages.

### Root Causes Identified:
1. ❌ **Missing Meilisearch indexing** in admin service
2. ❌ **Silent error handling** in product creation form
3. ❌ **No transaction rollback** on inventory failure
4. ❌ **Silent inventory creation failure** (ON CONFLICT DO NOTHING)

---

## Task List

### 🔴 PHASE 1: CRITICAL FIXES (Do Immediately)

#### Task 1.1: Add Meilisearch Indexing to Admin Service
- **Priority:** CRITICAL
- **Estimated Time:** 30 minutes
- **File:** `services/admin/main.py`
- **Location:** After line 4580 (after inventory creation)
- **Status:** ⏳ Pending

**Action Required:**
Add Meilisearch indexing call after product creation, matching the commerce service implementation.

**Code to Add:**
```python
# Index in Meilisearch for search functionality
try:
    from search.meilisearch_client import index_product as meili_index_product

    # Fetch full product data
    product_row = db.execute(
        text("""
        SELECT p.*, c.name as collection_name
        FROM products p
        LEFT JOIN collections c ON p.category_id = c.id
        WHERE p.id = :pid
        """), {"pid": product_id}
    ).fetchone()

    if product_row and product_row.is_active:
        enriched_product = {
            "id": product_row.id,
            "name": product_row.name,
            "slug": product_row.slug,
            "description": product_row.description,
            "short_description": product_row.short_description,
            "base_price": float(product_row.base_price),
            "mrp": float(product_row.mrp) if product_row.mrp else None,
            "category_id": product_row.category_id,
            "collection_name": product_row.collection_name,
            "is_active": product_row.is_active,
            "is_featured": product_row.is_featured,
            "is_new_arrival": product_row.is_new_arrival,
            "created_at": product_row.created_at.isoformat() if product_row.created_at else None,
        }
        meili_index_product(enriched_product)
        logger.info(f"Indexed product #{product_id} in Meilisearch")
except Exception as e:
    logger.warning(f"Failed to index product #{product_id} in Meilisearch: {e}")
```

**Testing:**
- [ ] Create a new product via admin panel
- [ ] Verify product appears in search results
- [ ] Check Meilisearch index: `curl http://localhost:7700/indexes/products/documents`

---

#### Task 1.2: Fix Error Handling in Product Creation Form
- **Priority:** CRITICAL
- **Estimated Time:** 15 minutes
- **File:** `frontend_new/app/admin/products/create/page.js`
- **Location:** Lines 193-196 (catch block)
- **Status:** ⏳ Pending

**Action Required:**
Show error messages instead of redirecting on failure.

**Code Change:**
```javascript
// CHANGE FROM:
} catch (err) {
  logger.error('Error creating product:', err);
  router.push('/admin/products');
}

// CHANGE TO:
} catch (err) {
  logger.error('Error creating product:', err);
  setErrors(prev => ({
    ...prev,
    _general: err?.message || 'Failed to create product. Please try again.'
  }));
  // Stay on page so user can see the error and fix issues
} finally {
  setLoading(false);
}
```

**Testing:**
- [ ] Trigger an error (e.g., network disconnect)
- [ ] Verify error message is displayed
- [ ] Verify user stays on page
- [ ] Verify no redirect on error

---

### 🟠 PHASE 2: HIGH PRIORITY FIXES (Do This Week)

#### Task 2.1: Add Transaction Rollback for Product + Inventory
- **Priority:** HIGH
- **Estimated Time:** 45 minutes
- **File:** `services/admin/main.py`
- **Location:** Lines 4560-4580
- **Status:** ⏳ Pending

**Action Required:**
Use a single database transaction for both product and inventory creation.

**Code Change:**
```python
# Wrap both operations in single transaction
try:
    # Create product
    result = db.execute(text("""INSERT INTO products (...) VALUES (...) RETURNING id"""), {...})
    product_id = result.scalar()
    
    # Create inventory
    initial_stock = getattr(data, "initial_stock", 0) or 0
    base_sku = f"PRD-{product_id}-BASE"
    db.execute(text("""
    INSERT INTO inventory (product_id, sku, size, color, quantity, low_stock_threshold, created_at, updated_at)
    VALUES (:pid, :sku, 'One Size', 'Default', :qty, 5, :now, :now)
    """), {"pid": product_id, "sku": base_sku, "qty": initial_stock, ...})
    
    # Single commit for both operations
    db.commit()
except Exception as e:
    db.rollback()
    logger.error(f"Failed to create product: {e}")
    raise HTTPException(status_code=500, detail="Failed to create product")
```

**Testing:**
- [ ] Simulate inventory creation failure
- [ ] Verify product is NOT created (rollback works)
- [ ] Check database for orphaned products

---

#### Task 2.2: Remove ON CONFLICT DO NOTHING Clause
- **Priority:** HIGH
- **Estimated Time:** 20 minutes
- **File:** `services/admin/main.py`
- **Location:** Line 4575
- **Status:** ⏳ Pending

**Action Required:**
Remove silent failure and handle duplicate SKU explicitly.

**Code Change:**
```python
# CHANGE FROM:
db.execute(text("""
INSERT INTO inventory (...)
VALUES (...)
ON CONFLICT (sku) DO NOTHING
"""), {...})

# CHANGE TO:
try:
    db.execute(text("""
    INSERT INTO inventory (...)
    VALUES (...)
    """), {...})
except IntegrityError as e:
    db.rollback()
    logger.error(f"Duplicate SKU: {e}")
    raise HTTPException(status_code=400, detail=f"SKU already exists")
```

**Testing:**
- [ ] Try to create product with duplicate SKU
- [ ] Verify error is raised
- [ ] Verify appropriate error message shown to admin

---

### 🟡 PHASE 3: UX IMPROVEMENTS (Do Next Week)

#### Task 3.1: Add Success/Error Toast Notifications
- **Priority:** MEDIUM
- **Estimated Time:** 30 minutes
- **File:** `frontend_new/app/admin/products/create/page.js`
- **Status:** ⏳ Pending

**Action Required:**
Add toast notification component for user feedback.

**Implementation:**
- Use react-hot-toast or similar library
- Show success toast after successful creation
- Show error toast on failure
- Add toast to product update page as well

**Testing:**
- [ ] Create product successfully → see success toast
- [ ] Create product with error → see error toast
- [ ] Update product → see appropriate toast

---

#### Task 3.2: Improve Inactive Product Visibility in Admin List
- **Priority:** MEDIUM
- **Estimated Time:** 25 minutes
- **File:** `frontend_new/app/admin/products/page.js`
- **Status:** ⏳ Pending

**Action Required:**
Make inactive products more visually distinct.

**Code Change:**
```javascript
// Enhance status badge in ProductRow component:
<span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
  product.is_active
    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
    : 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
}`}>
  {product.is_active ? (
    <>
      <CheckCircle className="w-3 h-3" />
      Active
    </>
  ) : (
    <>
      <AlertCircle className="w-3 h-3" />
      Inactive - Not visible to customers
    </>
  )}
</span>
```

**Testing:**
- [ ] Verify inactive products are clearly marked
- [ ] Verify warning message is visible
- [ ] Test filter for active/inactive products

---

#### Task 3.3: Add Filter Toggle for Active/Inactive Products
- **Priority:** LOW
- **Estimated Time:** 20 minutes
- **File:** `frontend_new/app/admin/products/page.js`
- **Status:** ⏳ Pending

**Action Required:**
Add prominent filter toggle for product status.

**Implementation:**
- Add filter buttons: "All", "Active", "Inactive"
- Make filter state persistent
- Show count for each filter

**Testing:**
- [ ] Filter by active products
- [ ] Filter by inactive products
- [ ] Show all products

---

### 🔵 PHASE 4: MONITORING & OPTIMIZATION (Nice to Have)

#### Task 4.1: Add Monitoring for Meilisearch Indexing Failures
- **Priority:** LOW
- **Estimated Time:** 40 minutes
- **File:** `services/commerce/search/meilisearch_client.py`
- **Status:** ⏳ Pending

**Action Required:**
Add logging and alerting for indexing failures.

---

#### Task 4.2: Enhance API Error Propagation
- **Priority:** LOW
- **Estimated Time:** 30 minutes
- **File:** `frontend_new/lib/adminApi.js`
- **Status:** ⏳ Pending

**Action Required:**
Improve error handling in base API client.

---

## Implementation Checklist

### Before Starting:
- [ ] Backup database
- [ ] Create git branch: `fix/product-upload-issues`
- [ ] Notify team of planned changes

### Phase 1 (Critical):
- [ ] Task 1.1: Add Meilisearch indexing
- [ ] Task 1.2: Fix error handling
- [ ] Test both fixes together
- [ ] Deploy to staging
- [ ] Verify in staging environment

### Phase 2 (High Priority):
- [ ] Task 2.1: Add transaction rollback
- [ ] Task 2.2: Remove ON CONFLICT clause
- [ ] Test transaction behavior
- [ ] Deploy to staging
- [ ] Verify rollback works

### Phase 3 (UX Improvements):
- [ ] Task 3.1: Add toast notifications
- [ ] Task 3.2: Improve inactive visibility
- [ ] Task 3.3: Add filter toggle
- [ ] User testing
- [ ] Deploy to production

### Phase 4 (Monitoring):
- [ ] Task 4.1: Add monitoring
- [ ] Task 4.2: Enhance error propagation
- [ ] Set up alerts
- [ ] Document monitoring

### After Completion:
- [ ] Full regression testing
- [ ] Update documentation
- [ ] Create runbook for product issues
- [ ] Merge to main branch
- [ ] Deploy to production
- [ ] Monitor for 48 hours

---

## Testing Plan

### Manual Testing Scenarios:

1. **Create Product Successfully**
   - Fill all required fields
   - Upload images
   - Create variants
   - Verify success message
   - Verify product appears in admin list
   - Verify product appears on customer page
   - Verify product appears in search

2. **Create Product with Error**
   - Submit form with missing required field
   - Verify error message shown
   - Verify no redirect
   - Verify form data preserved

3. **Create Inactive Product**
   - Uncheck "Active" checkbox
   - Submit form
   - Verify product appears in admin list as "Inactive"
   - Verify product does NOT appear on customer page
   - Verify warning message visible

4. **Search Functionality**
   - Create new product
   - Wait 5 seconds
   - Search for product by name
   - Verify product appears in search results

5. **Transaction Rollback**
   - Simulate inventory creation failure
   - Verify product NOT created
   - Check database for orphaned records

### Automated Testing:
- [ ] Add unit tests for admin product creation
- [ ] Add integration tests for Meilisearch indexing
- [ ] Add E2E tests for product creation flow
- [ ] Add regression tests for error handling

---

## Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback:**
   ```bash
   git revert HEAD
   docker-compose restart aarya_admin aarya_commerce
   ```

2. **Database Cleanup:**
   ```sql
   -- Remove orphaned products (if any)
   DELETE FROM products WHERE id NOT IN (SELECT product_id FROM inventory);
   ```

3. **Meilisearch Reindex:**
   ```bash
   # Trigger full reindex from commerce service
   curl -X POST http://localhost:5002/api/v1/products/reindex
   ```

---

## Success Metrics

After implementation, verify:

- [ ] 100% of products created via admin appear in search
- [ ] 0 silent failures (all errors shown to admin)
- [ ] 0 orphaned products (transaction rollback works)
- [ ] < 5 second delay from creation to customer visibility
- [ ] Admin satisfaction score > 8/10

---

## Related Documentation

- **Full Analysis Report:** `ADMIN_PRODUCT_FLOW_COMPLETE_ANALYSIS.md`
- **Investigation Report:** `PRODUCT_ISSUE_INVESTIGATION_REPORT.md`
- **API Documentation:** `docs/api/`
- **Database Schema:** `docs/database/`

---

## Team Assignments

| Task | Assigned To | Due Date | Status |
|------|-------------|----------|--------|
| 1.1 - Meilisearch Indexing | Backend Team | 2026-03-26 | ⏳ Pending |
| 1.2 - Error Handling | Frontend Team | 2026-03-26 | ⏳ Pending |
| 2.1 - Transaction Rollback | Backend Team | 2026-03-27 | ⏳ Pending |
| 2.2 - ON CONFLICT Removal | Backend Team | 2026-03-27 | ⏳ Pending |
| 3.1 - Toast Notifications | Frontend Team | 2026-03-28 | ⏳ Pending |
| 3.2 - Inactive Visibility | Frontend Team | 2026-03-28 | ⏳ Pending |
| 3.3 - Filter Toggle | Frontend Team | 2026-03-29 | ⏳ Pending |
| 4.1 - Monitoring | DevOps Team | 2026-03-30 | ⏳ Pending |
| 4.2 - Error Propagation | Frontend Team | 2026-03-30 | ⏳ Pending |

---

## Notes

- All changes must be tested in staging before production
- Database backup required before Phase 2 changes
- Monitor logs closely for 48 hours after deployment
- Update this document as tasks are completed

---

**Last Updated:** 2026-03-26  
**Next Review:** 2026-03-27  
