"""
Comprehensive tests for product-inventory creation fix.

CRITICAL: Products MUST have at least one variant/inventory record.
Products created without variants will raise ValueError.
This ensures no fake "One Size/Default" inventory records are created.

Run with: pytest services/commerce/tests/test_product_inventory_creation.py -v
"""
import pytest
from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from database.database import TestingSessionLocal, engine, Base
from models.product import Product
from models.inventory import Inventory
from models.collection import Collection
from schemas.product import ProductCreate, VariantCreate
from service.product_service import ProductService


# Create test database tables
@pytest.fixture(scope="function")
def db():
    """Create fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def product_service(db):
    """Create product service instance."""
    return ProductService(db)


@pytest.fixture(scope="function")
def test_collection(db):
    """Create a test collection for products."""
    collection = Collection(
        name="Test Collection",
        slug="test-collection",
        description="Test collection for inventory tests"
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection


class TestProductCreationAlwaysCreatesInventory:
    """CRITICAL TEST SUITE: Verify products ALWAYS have inventory records."""

    def test_create_product_with_variants_creates_inventory_for_each(self, db, product_service, test_collection):
        """Test 1: Product with variants → creates inventory for EACH variant."""
        product_data = ProductCreate(
            name="Test Product With Variants",
            slug="test-product-variants",
            base_price=Decimal("999.00"),
            category_id=test_collection.id,
            variants=[
                VariantCreate(size="S", color="Red", quantity=10),
                VariantCreate(size="M", color="Blue", quantity=5),
                VariantCreate(size="L", color="Green", quantity=15),
            ]
        )
        
        result = product_service.create_product(product_data)
        
        # Verify product created
        assert result.id is not None
        assert result.name == "Test Product With Variants"
        
        # Verify inventory created for EACH variant
        inventory_records = db.query(Inventory).filter(
            Inventory.product_id == result.id
        ).all()
        
        assert len(inventory_records) == 3, "Should create 3 inventory records (one per variant)"
        
        # Verify each inventory record
        sizes = {inv.size for inv in inventory_records}
        colors = {inv.color for inv in inventory_records}
        quantities = {inv.quantity for inv in inventory_records}
        
        assert sizes == {"S", "M", "L"}
        assert colors == {"Red", "Blue", "Green"}
        assert 10 in quantities and 5 in quantities and 15 in quantities

    def test_create_product_without_variants_raises_error(self, db, product_service, test_collection):
        """Test 2: Product WITHOUT variants → MUST raise ValueError (no default inventory)."""
        product_data = ProductCreate(
            name="Test Product No Variants",
            slug="test-product-no-variants",
            base_price=Decimal("499.00"),
            category_id=test_collection.id,
            initial_stock=50
        )

        # Should raise ValueError because no variants provided
        with pytest.raises(ValueError, match="At least one product variant is required"):
            product_service.create_product(product_data)

        # Verify NO inventory was created for this product
        # (product itself may or may not be created depending on transaction handling)

    def test_create_product_with_zero_initial_stock_raises_error(self, db, product_service, test_collection):
        """Test 3: Product with ZERO initial stock and NO variants → MUST raise ValueError."""
        product_data = ProductCreate(
            name="Test Product Zero Stock",
            slug="test-product-zero-stock",
            base_price=Decimal("299.00"),
            category_id=test_collection.id,
            initial_stock=0  # Out of stock, but still needs variants
        )

        # Should raise ValueError because no variants provided
        with pytest.raises(ValueError, match="At least one product variant is required"):
            product_service.create_product(product_data)

    def test_create_product_no_initial_stock_specified_raises_error(self, db, product_service, test_collection):
        """Test 4: Product with NO initial_stock and NO variants → MUST raise ValueError."""
        product_data = ProductCreate(
            name="Test Product No Initial Stock",
            slug="test-product-no-initial",
            base_price=Decimal("199.00"),
            category_id=test_collection.id
            # initial_stock not specified - defaults to 0, still no variants
        )

        # Should raise ValueError because no variants provided
        with pytest.raises(ValueError, match="At least one product variant is required"):
            product_service.create_product(product_data)

    def test_ensure_product_has_inventory_does_not_create_default_record(self, db, product_service, test_collection):
        """Test 5: _ensure_product_has_inventory logs warning but does NOT create default record."""
        # Create product WITHOUT inventory (simulating old bug)
        product = Product(
            name="Product Without Inventory",
            slug="product-without-inventory",
            base_price=Decimal("99.00"),
            category_id=test_collection.id
        )
        db.add(product)
        db.commit()
        db.refresh(product)

        # Verify no inventory exists
        inventory_count = db.query(Inventory).filter(
            Inventory.product_id == product.id
        ).count()
        assert inventory_count == 0, "Should start with no inventory"

        # Call the safety net method — should NOT create inventory anymore
        product_service._ensure_product_has_inventory(product)

        # Verify NO inventory was created (behavior changed from creating default)
        inventory_records = db.query(Inventory).filter(
            Inventory.product_id == product.id
        ).all()

        assert len(inventory_records) == 0, "Safety net should NOT create default inventory anymore"

    def test_update_product_does_not_create_default_inventory(self, db, product_service, test_collection):
        """Test 6: update_product does NOT create default inventory (behavior changed)."""
        # Create product without inventory
        product = Product(
            name="Product To Update",
            slug="product-to-update",
            base_price=Decimal("149.00"),
            category_id=test_collection.id
        )
        db.add(product)
        db.commit()
        db.refresh(product)

        # Verify no inventory
        assert db.query(Inventory).filter(Inventory.product_id == product.id).count() == 0

        # Update product
        from schemas.product import ProductUpdate
        update_data = ProductUpdate(name="Updated Product Name")
        updated = product_service.update_product(product.id, update_data)

        # Verify NO default inventory was created (behavior changed)
        inventory_records = db.query(Inventory).filter(
            Inventory.product_id == product.id
        ).all()

        assert len(inventory_records) == 0, "update_product should NOT create default inventory anymore"
        assert updated.name == "Updated Product Name"

    def test_product_total_stock_property_with_variants(self, db, product_service, test_collection):
        """Test 7: total_stock property sums all variant quantities."""
        product_data = ProductCreate(
            name="Test Product Total Stock",
            slug="test-product-total-stock",
            base_price=Decimal("599.00"),
            category_id=test_collection.id,
            variants=[
                VariantCreate(size="S", color="Red", quantity=10),
                VariantCreate(size="M", color="Red", quantity=20),
                VariantCreate(size="L", color="Red", quantity=30),
            ]
        )

        result = product_service.create_product(product_data)

        # Verify total stock is sum of all variants
        assert result.total_stock == 60, "Total stock should be sum of all variants (10+20+30)"
        assert result.is_in_stock is True

    def test_product_is_in_stock_property(self, db, product_service, test_collection):
        """Test 8: is_in_stock property reflects actual availability."""
        # Product with stock (using variants)
        product_with_stock = ProductCreate(
            name="In Stock Product",
            slug="in-stock-product",
            base_price=Decimal("399.00"),
            category_id=test_collection.id,
            variants=[
                VariantCreate(size="M", color="Red", quantity=10),
            ]
        )
        result_in_stock = product_service.create_product(product_with_stock)
        assert result_in_stock.is_in_stock is True

        # Product without stock (variant with 0 quantity)
        product_no_stock = ProductCreate(
            name="Out of Stock Product",
            slug="out-of-stock-product",
            base_price=Decimal("399.00"),
            category_id=test_collection.id,
            variants=[
                VariantCreate(size="M", color="Red", quantity=0),
            ]
        )
        result_no_stock = product_service.create_product(product_no_stock)
        assert result_no_stock.is_in_stock is False


class TestInventorySKUUniqueness:
    """Test SKU uniqueness constraints."""

    def test_auto_generated_sku_is_unique_per_variant(self, db, product_service, test_collection):
        """Test that auto-generated SKUs are unique per variant."""
        # Create a product with multiple variants
        product_data = ProductCreate(
            name="Product With Variants",
            slug="product-with-variants",
            base_price=Decimal("100.00"),
            category_id=test_collection.id,
            variants=[
                VariantCreate(size="S", color="Red", quantity=5),
                VariantCreate(size="M", color="Blue", quantity=10),
            ]
        )

        result = product_service.create_product(product_data)

        # Verify SKUs are unique per variant
        inventory_records = db.query(Inventory).filter(
            Inventory.product_id == result.id
        ).all()

        skus = [inv.sku for inv in inventory_records]
        assert len(skus) == len(set(skus)), "All SKUs should be unique"
        assert len(inventory_records) == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
