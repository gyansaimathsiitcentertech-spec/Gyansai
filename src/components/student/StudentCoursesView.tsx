import React, { useState } from 'react';
import { usePortal } from '../../context/PortalContext';
import { Course } from '../../types';
import { X, CheckCircle } from 'lucide-react';

export const StudentCoursesView: React.FC = () => {
  const { courses, settings, currentUser, addPayment, showToast } = usePortal();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [utrNumber, setUtrNumber] = useState('');

  const publishedCourses = courses.filter(c => c.status !== 'Draft');

  const handleConfirmPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    if (!utrNumber.trim()) {
      showToast('Please enter your UPI UTR / Reference number.', 'error');
      return;
    }
    addPayment({
      studentId: currentUser?.id,
      studentName: currentUser?.name || 'Student',
      studentEmail: currentUser?.email || 'student@gyansai.in',
      itemName: selectedCourse.title,
      item: selectedCourse.title,
      itemType: 'Course',
      amount: selectedCourse.price,
      transactionId: utrNumber.trim(),
      utr: utrNumber.trim(),
      paymentMode: 'UPI',
      status: 'Pending'
    });
    setUtrNumber('');
    setSelectedCourse(null);
  };

  return (
    <div className="space-y-6 font-sans text-xs">
      {/* Top Header */}
      <div>
        <div className="text-xs font-mono font-medium tracking-widest text-gray-400 uppercase mb-1">
          // LEARNING
        </div>
        <h1 className="text-2xl font-extrabold text-gray-950 tracking-tight">
          Courses
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          {publishedCourses.length} published course{publishedCourses.length === 1 ? '' : 's'} available
        </p>
      </div>

      {/* Live Courses Grid */}
      {publishedCourses.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-sm p-12 text-center text-gray-500 font-mono">
          No published courses available right now. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {publishedCourses.map(course => (
            <div
              key={course.id}
              className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="h-48 bg-gray-100 border-b border-gray-200 relative overflow-hidden">
                  <img
                    src={course.thumbnailUrl || 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=600&q=80'}
                    alt={course.title}
                    className="w-full h-full object-cover opacity-90"
                  />
                </div>

                <div className="p-5 space-y-2">
                  <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 font-mono text-[10px] rounded border border-gray-200 uppercase">
                    {course.subject || course.category || 'Mathematics'}
                  </span>

                  <h3 className="text-sm font-bold text-gray-950">
                    {course.title}
                  </h3>

                  <p className="text-[11px] text-gray-500 font-sans leading-relaxed line-clamp-3">
                    {(course.description || course.subtitle || '').replace(/^##\s*/, '')}
                  </p>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <span className="font-extrabold font-mono text-sm text-gray-900">
                  ₹{course.price}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setUtrNumber('');
                    setSelectedCourse(course);
                  }}
                  className="px-4 py-1.5 bg-[#002FA7] hover:bg-blue-800 text-white font-semibold text-xs rounded cursor-pointer shadow-2xs transition"
                >
                  Buy ₹{course.price}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual UPI Checkout Modal using live Admin InstituteSettings */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm border border-gray-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <div className="text-[10px] font-mono uppercase text-gray-400">UPI / BANK CHECKOUT</div>
                <h3 className="text-sm font-bold text-gray-950">{selectedCourse.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCourse(null)}
                className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-gray-900">
                <span>Amount Payable:</span>
                <span className="font-mono text-[#002FA7]">₹{selectedCourse.price}</span>
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
                  onClick={() => setSelectedCourse(null)}
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
