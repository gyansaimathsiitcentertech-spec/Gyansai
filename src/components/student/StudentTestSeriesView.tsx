import React, { useState } from 'react';
import { usePortal } from '../../context/PortalContext';
import { TestSeries } from '../../types';
import { X, CheckCircle } from 'lucide-react';

export const StudentTestSeriesView: React.FC = () => {
  const { testSeries, settings, currentUser, addPayment, showToast } = usePortal();
  const [selectedSeries, setSelectedSeries] = useState<TestSeries | null>(null);
  const [utrNumber, setUtrNumber] = useState('');

  const activeSeries = testSeries.filter(ts => ts.status !== 'Archived');

  const handleConfirmPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeries) return;
    if (!utrNumber.trim()) {
      showToast('Please enter your UPI UTR / Reference number.', 'error');
      return;
    }
    addPayment({
      studentId: currentUser?.id,
      studentName: currentUser?.name || 'Student',
      studentEmail: currentUser?.email || 'student@gyansai.in',
      itemName: selectedSeries.title,
      item: selectedSeries.title,
      itemType: 'Test Series',
      amount: selectedSeries.price,
      transactionId: utrNumber.trim(),
      utr: utrNumber.trim(),
      paymentMode: 'UPI',
      status: 'Pending'
    });
    setUtrNumber('');
    setSelectedSeries(null);
  };

  return (
    <div className="space-y-6 font-sans text-xs">
      {/* Top Header */}
      <div>
        <div className="text-xs font-mono font-medium tracking-widest text-gray-400 uppercase mb-1">
          // MARKETPLACE
        </div>
        <h1 className="text-2xl font-extrabold text-gray-950 tracking-tight">
          Test Series
        </h1>
        <p className="text-xs text-gray-500 font-sans mt-1">
          Compete with All-India ranks &bull; {activeSeries.length} active series
        </p>
      </div>

      {/* Live Test Series Grid */}
      {activeSeries.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-sm p-12 text-center text-gray-500 font-mono">
          No active test series available right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeSeries.map(ts => (
            <div
              key={ts.id}
              className="bg-white border border-gray-200 rounded-sm p-6 space-y-4 shadow-2xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 font-mono text-[10px] rounded border border-gray-200">
                  {ts.category || 'Test Series'}
                </span>

                <h3 className="text-sm font-bold text-gray-950">
                  {ts.title}
                </h3>

                <p className="text-xs text-gray-500 font-sans leading-relaxed">
                  {ts.description || ts.subtitle}
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <div className="text-base font-extrabold font-mono text-gray-950">
                    ₹{ts.price}
                  </div>
                  <div className="text-[11px] font-mono text-gray-400">
                    {ts.testCount ?? ts.testsCount ?? 0} mocks
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUtrNumber('');
                    setSelectedSeries(ts);
                  }}
                  className="px-4 py-1.5 bg-[#002FA7] hover:bg-blue-800 text-white font-semibold rounded cursor-pointer shadow-2xs transition"
                >
                  Buy now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Note */}
      <div className="pt-4 text-xs font-mono text-gray-500 leading-relaxed">
        Payment is manual via UPI/bank transfer. After submitting your UTR, admin verifies & unlocks within <span className="font-bold text-gray-800">1 hour</span>.
      </div>

      {/* UPI Checkout Modal */}
      {selectedSeries && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm border border-gray-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <div className="text-[10px] font-mono uppercase text-gray-400">UPI / BANK CHECKOUT</div>
                <h3 className="text-sm font-bold text-gray-950">{selectedSeries.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSeries(null)}
                className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-gray-900">
                <span>Amount Payable:</span>
                <span className="font-mono text-[#002FA7]">₹{selectedSeries.price}</span>
              </div>
              {settings?.upiId && (
                <div className="flex justify-between text-gray-700">
                  <span>UPI ID:</span>
                  <span className="font-mono font-semibold">{settings.upiId}</span>
                </div>
              )}
              {settings?.bankName && (
                <div className="flex justify-between text-gray-600">
                  <span>Bank:</span>
                  <span>{settings.bankName}</span>
                </div>
              )}
              {settings?.accountNo && (
                <div className="flex justify-between text-gray-600">
                  <span>Account / IFSC:</span>
                  <span className="font-mono">{settings.accountNo} / {settings.ifsc}</span>
                </div>
              )}
              {settings?.upiQrCodeUrl && (
                <div className="pt-2 flex justify-center">
                  <img
                    src={settings.upiQrCodeUrl}
                    alt="Institute UPI QR"
                    className="w-40 h-40 object-contain border border-gray-200 rounded bg-white p-1"
                  />
                </div>
              )}
            </div>

            <form onSubmit={handleConfirmPurchase} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Enter 12-digit UPI UTR / Transaction Reference *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 432198765432"
                  value={utrNumber}
                  onChange={e => setUtrNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:border-[#002FA7]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSeries(null)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#002FA7] hover:bg-blue-800 text-white font-semibold rounded flex items-center space-x-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Submit Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
