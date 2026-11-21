import React, { useMemo } from 'react';
import { usePortal } from '../../context/PortalContext';
import { RotateCw } from 'lucide-react';

export const StudentPurchasesView: React.FC = () => {
  const { setActiveStudentTab, showToast, payments, currentUser } = usePortal();

  const myPayments = useMemo(() => {
    if (!currentUser) return [];
    const curEmail = (currentUser.email || '').toLowerCase();
    const curName = (currentUser.name || '').toLowerCase();
    return payments.filter(
      p =>
        (p.studentId && p.studentId === currentUser.id) ||
        (curEmail && (p.studentEmail || '').toLowerCase() === curEmail) ||
        (curName && (p.studentName || '').toLowerCase() === curName)
    );
  }, [payments, currentUser]);

  return (
    <div className="space-y-6 font-sans text-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-mono font-medium tracking-widest text-gray-400 uppercase mb-1">
            // ACCOUNT
          </div>
          <h1 className="text-2xl font-extrabold text-gray-950 tracking-tight">
            My Purchases
          </h1>
          <p className="text-xs text-gray-500 font-sans mt-1">
            All your payments — pending, approved &amp; rejected.
          </p>
        </div>

        <button
          type="button"
          onClick={() => showToast('Purchases refreshed.')}
          className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center space-x-1.5 cursor-pointer shadow-2xs"
        >
          <RotateCw className="w-3.5 h-3.5 text-gray-500" />
          <span>Refresh</span>
        </button>
      </div>

      {myPayments.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-sm p-16 flex flex-col items-center justify-center text-center space-y-3 min-h-[360px]">
          <div className="text-3xl text-gray-400 font-mono">
            ₹
          </div>

          <div className="font-bold text-sm text-gray-900">
            No purchases yet
          </div>

          <p className="text-xs text-gray-500 font-sans">
            Browse{' '}
            <button
              type="button"
              onClick={() => setActiveStudentTab('Courses')}
              className="text-blue-700 underline cursor-pointer"
            >
              courses
            </button>{' '}
            or{' '}
            <button
              type="button"
              onClick={() => setActiveStudentTab('Test Series')}
              className="text-blue-700 underline cursor-pointer"
            >
              test series
            </button>{' '}
            to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-sm overflow-x-auto shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-mono uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">UTR / Ref</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {myPayments.map(pay => {
                const isVerified = pay.status === 'Verified' || pay.status === 'SUCCESS' || pay.status === 'Success';
                const isRejected = pay.status === 'REJECTED' || pay.status === 'Failed';
                return (
                  <tr key={pay.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {pay.itemName || pay.item || 'Portal Subscription'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{pay.itemType || 'Course'}</td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">₹{pay.amount}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{pay.utr || pay.transactionId || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono">{pay.date || pay.submitted || 'Recent'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                          isVerified
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isRejected
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isVerified ? 'Approved' : isRejected ? 'Rejected' : 'Pending'}
                      </span>
                      {isRejected && pay.actionReason && (
                        <div className="text-[10px] text-red-600 mt-0.5">{pay.actionReason}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
