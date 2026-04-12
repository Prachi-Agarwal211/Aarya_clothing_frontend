'use client';

export default function AdminError({ error, reset }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050203]">
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-red-400 mb-4">Admin Dashboard Error</h2>
        <p className="text-[#EAE0D5]/60 mb-6">An error occurred. Please try again or contact support.</p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-[#B76E79] text-white rounded-xl hover:bg-[#B76E79]/80 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
