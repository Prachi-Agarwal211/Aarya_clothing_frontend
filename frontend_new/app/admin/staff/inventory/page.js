'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter,
  Package,
  AlertTriangle,
  Plus,
  Minus,
  Save,
} from 'lucide-react';
import DataTable from '@/components/admin/shared/DataTable';
import { inventoryApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

export default function StaffInventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, low_stock, out_of_stock
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);

      let data;
      if (filter === 'out_of_stock') {
        data = await inventoryApi.getOutOfStock();
      } else if (filter === 'low_stock') {
        data = await inventoryApi.getLowStock();
      } else {
        data = await inventoryApi.list({ search, limit: 50 });
      }

      setInventory(data.items || data || []);
    } catch (err) {
      logger.error('Error fetching inventory:', err);
      setError('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [filter]);

  const handleSearch = () => {
    fetchInventory();
  };

  const handleAdjustStock = async (productId, variantId, adjustment) => {
    try {
      setSaving(true);
      await inventoryApi.adjustVariantStock(productId, variantId, adjustment, 'Staff adjustment');
      await fetchInventory();
      setEditingId(null);
    } catch (err) {
      logger.error('Failed to adjust stock:', err);
      setError('Failed to update stock');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'product_name',
      label: 'Product',
    },
    {
      key: 'sku',
      label: 'SKU',
    },
    {
      key: 'size',
      label: 'Size',
    },
    {
      key: 'color',
      label: 'Color',
    },
    {
      key: 'quantity',
      label: 'Stock',
      render: (item) => {
        const isLow = item.quantity <= (item.low_stock_threshold || 5);
        const isOut = item.quantity === 0;
        
        return (
          <div className="flex items-center gap-2">
            {editingId === item.id ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAdjustStock(item.product_id, item.id, -1)}
                  disabled={saving || item.quantity <= 0}
                  className="p-1 bg-red-500/20 rounded hover:bg-red-500/40"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-16 px-2 py-1 bg-[#1a1a1a] border border-[#B76E79]/20 rounded text-center"
                />
                <button
                  onClick={() => handleAdjustStock(item.product_id, item.id, 1)}
                  disabled={saving}
                  className="p-1 bg-green-500/20 rounded hover:bg-green-500/40"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className={isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-green-400'}>
                {item.quantity}
              </span>
            )}
            
            {isOut && (
              <AlertTriangle className="w-4 h-4 text-red-400" title="Out of Stock" />
            )}
            {isLow && !isOut && (
              <AlertTriangle className="w-4 h-4 text-amber-400" title="Low Stock" />
            )}
          </div>
        );
      },
    },
    {
      key: 'price',
      label: 'Price',
      render: (item) => `₹${(item.price || 0).toLocaleString('en-IN')}`,
    },
    {
      key: 'actions',
      label: 'Quick Adjust',
      render: (item) => (
        <div className="flex gap-1">
          <button
            onClick={() => {
              setEditingId(item.id);
              setEditValue(item.quantity.toString());
            }}
            className="p-1.5 text-[#F2C29A] hover:text-white transition-colors"
            title="Adjust Stock"
          >
            <Package className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#EAE0D5]" style={{ fontFamily: 'Cinzel, serif' }}>
            Inventory Management
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">
            View and manage stock levels
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all' 
                ? 'bg-[#7A2F57] text-white' 
                : 'bg-[#0B0608]/60 border border-[#B76E79]/20 text-[#EAE0D5]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('low_stock')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'low_stock' 
                ? 'bg-amber-600 text-white' 
                : 'bg-[#0B0608]/60 border border-[#B76E79]/20 text-[#EAE0D5]'
            }`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setFilter('out_of_stock')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'out_of_stock' 
                ? 'bg-red-600 text-white' 
                : 'bg-[#0B0608]/60 border border-[#B76E79]/20 text-[#EAE0D5]'
            }`}
          >
            Out of Stock
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7D77]" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#8B7D77] focus:outline-none focus:border-[#F2C29A]"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-[#7A2F57] text-white rounded-lg hover:bg-[#7A2F57]/80"
        >
          Search
        </button>
      </div>

      {/* Inventory Table */}
      <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-[#1a1a1a] rounded" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        ) : inventory.length > 0 ? (
          <DataTable columns={columns} data={inventory} />
        ) : (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 text-[#8B7D77] mx-auto mb-3" />
            <p className="text-[#EAE0D5]/60">No inventory items found</p>
          </div>
        )}
      </div>
    </div>
  );
}
