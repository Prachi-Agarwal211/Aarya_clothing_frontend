'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Ensure image URL is usable. Backend returns full R2 URLs;
 * this is a safety net for any edge cases.
 */
function ensureFullUrl(url) {
  if (!url) return '/placeholder-collection.jpg';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return url.startsWith('/') ? url : `/${url}`;
}

const CategoryCard = ({ category, className }) => {
  // Support both old shape {name,image,link} and new DB shape {name,image_url,slug,product_count}
  const name = category.name;
  const image = category.image_url || category.image || '';
  const link = category.link || `/collections/${category.slug}` || '#';
  const count = category.product_count ?? category.count;

  return (
    <Link 
      href={link}
      className={cn(
        "group relative block w-full overflow-hidden h-[400px] cursor-pointer rounded-2xl",
        className
      )}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={ensureFullUrl(image)}
          alt={name}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050203] via-transparent to-transparent opacity-80" />
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 w-full p-8 transform transition-transform duration-500">
        <div className="relative z-10">
          <span className="text-[#F2C29A] text-xs tracking-[0.2em] uppercase block mb-2 opacity-0 transform -translate-y-4 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0">
            Collection
          </span>
          <h3 className="text-3xl font-cinzel text-[#EAE0D5] mb-2 group-hover:text-white transition-colors">
            {name}
          </h3>
          <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-500">
            <div className="pt-4 flex items-center gap-2 text-[#B76E79] tracking-wider text-sm font-medium">
              EXPLORE <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Border Effect */}
      <div className="absolute inset-4 border border-[#F2C29A]/20 scale-95 opacity-0 transition-all duration-500 group-hover:scale-100 group-hover:opacity-100 pointer-events-none rounded-2xl" />
    </Link>
  );
};

export default CategoryCard;
