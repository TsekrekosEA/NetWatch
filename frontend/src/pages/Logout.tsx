interface LogoutProps {
  onConfirm?: () => void;
}

export default function Logout({ onConfirm }: LogoutProps) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold mb-1">Logout</h2>
        <p className="text-sm text-slate-400">This clears local dashboard state and returns you to the overview.</p>
      </div>

      <div className="card space-y-4">
        <p className="text-gray-300">Confirm to clear stored preferences and session filters.</p>
        <button
          className="px-3 py-2 bg-dark-surface_2 border border-dark-border text-white"
          onClick={() => {
            localStorage.removeItem('netwatch.settings');
            sessionStorage.clear();
            onConfirm?.();
          }}
        >
          Confirm logout
        </button>
      </div>
    </div>
  );
}
