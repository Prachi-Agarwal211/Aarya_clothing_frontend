'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * CheckoutProgress - Premium checkout progress stepper
 * 
 * Features:
 * - Visual progress indication
 * - Animated transitions
 * - Step validation states
 * - Mobile responsive
 */
const CheckoutProgress = ({
  steps = [],
  currentStep = 0,
  className,
}) => {
  return (
    <div className={cn('checkout-progress', className)}>
      <div className="checkout-progress-steps">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={index}>
              {/* Step Circle */}
              <div className="checkout-progress-step">
                <div
                  className={cn(
                    'checkout-progress-circle',
                    isCompleted && 'completed',
                    isCurrent && 'current'
                  )}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="checkout-progress-label">
                  <span className="text-sm font-medium text-[#F3E8EB]">
                    {step.label}
                  </span>
                  {step.description && (
                    <span className="text-xs text-[#8B7B8F] hidden md:block">
                      {step.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div
                  className={cn(
                    'checkout-progress-connector',
                    isCompleted && 'completed'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/**
 * CheckoutProgressCompact - Compact version for mobile
 */
export const CheckoutProgressCompact = ({
  steps = [],
  currentStep = 0,
  className,
}) => {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <React.Fragment key={index}>
            <div
              className={cn(
                'flex-1 h-1 rounded-full transition-all duration-300',
                isCompleted || isCurrent ? 'bg-[#B76E79]' : 'bg-[#3D2C35]'
              )}
            />
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-1 rounded-full transition-all duration-300',
                  isCompleted ? 'bg-[#B76E79]' : 'bg-[#3D2C35]'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/**
 * CheckoutStepContent - Wrapper for step content with animations
 */
export const CheckoutStepContent = ({
  children,
  isActive,
  className,
}) => {
  if (!isActive) return null;

  return (
    <div
      className={cn(
        'checkout-step-content',
        className
      )}
    >
      {children}
    </div>
  );
};

/**
 * CheckoutNavigation - Navigation buttons for checkout
 */
export const CheckoutNavigation = ({
  onBack,
  onNext,
  onSubmit,
  isLastStep = false,
  isFirstStep = false,
  isLoading = false,
  backLabel = 'Back',
  nextLabel = 'Continue',
  submitLabel = 'Place Order',
}) => {
  return (
    <div className="flex justify-between items-center pt-6 border-t border-[#3D2C35]">
      <button
        onClick={onBack}
        disabled={isFirstStep}
        className={cn(
          'px-6 py-3 rounded-xl font-medium transition-all duration-300',
          isFirstStep
            ? 'opacity-0 pointer-events-none'
            : 'text-[#B76E79] hover:text-[#F3E8EB] border border-[#3D2C35] hover:border-[#B76E79]'
        )}
      >
        {backLabel}
      </button>

      {isLastStep ? (
        <button
          onClick={onSubmit}
          disabled={isLoading}
          className="px-8 py-3 bg-[#7A2F57] text-white rounded-xl font-medium hover:bg-[#6A2547] transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : (
            submitLabel
          )}
        </button>
      ) : (
        <button
          onClick={onNext}
          className="px-8 py-3 bg-[#7A2F57] text-white rounded-xl font-medium hover:bg-[#6A2547] transition-colors"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
};

export default CheckoutProgress;
