/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PortalProvider, usePortal } from './context/PortalContext';
import { Sidebar } from './components/common/Sidebar';
import { ShareExamModal } from './components/common/ShareExamModal';
import { CreateFolderModal } from './components/common/CreateFolderModal';
import { CreateQuestionModal } from './components/common/CreateQuestionModal';
import { ViewQuestionsModal } from './components/common/ViewQuestionsModal';
import { QuickJoinModal } from './components/public/QuickJoinModal';
import { AuthModal } from './components/public/AuthModal';
import { AdminLoginModal } from './components/common/AdminLoginModal';
import { SharedExamLanding } from './components/public/SharedExamLanding';
import { LandingPage } from './components/public/LandingPage';
import { LoginView } from './components/public/LoginView';
import { OnlineExamInterface } from './components/exam/OnlineExamInterface';
import { ToastContainer } from './components/common/ToastContainer';
import { InstituteLogo } from './components/common/InstituteLogo';
import { Lock, Eye, EyeOff } from 'lucide-react';

// Admin Views
import { AdminDashboard } from './components/admin/AdminDashboard';
import { StudentsView } from './components/admin/StudentsView';
import { TeachersView } from './components/admin/TeachersView';
import { BatchesView } from './components/admin/BatchesView';
import { QuestionBankView } from './components/admin/QuestionBankView';
import { ExamManagementView } from './components/admin/ExamManagementView';
import { CreateExamView } from './components/admin/CreateExamView';
import { AttendanceView } from './components/admin/AttendanceView';
import { StudyMaterialView } from './components/admin/StudyMaterialView';
import { NotificationsView } from './components/admin/NotificationsView';
import { ResultsRecordingView } from './components/admin/ResultsRecordingView';
import { EvaluationView } from './components/admin/EvaluationView';
import { PaymentsView } from './components/admin/PaymentsView';
import { CoursesView } from './components/admin/CoursesView';
import { TestSeriesView } from './components/admin/TestSeriesView';
import { InstituteSettingsView } from './components/admin/InstituteSettingsView';

// Student Views
import { StudentDashboard } from './components/student/StudentDashboard';
import { StudentExamsView } from './components/student/StudentExamsView';
import { StudentCoursesView } from './components/student/StudentCoursesView';
import { StudentTestSeriesView } from './components/student/StudentTestSeriesView';
import { StudentPurchasesView } from './components/student/StudentPurchasesView';
import { StudentProfileView } from './components/student/StudentProfileView';

const AdminAccessGate: React.FC = () => {
  const { loginAdmin, signInAdminWithGoogle, setPortalMode } = usePortal();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Please enter administrator password.');
      return;
    }
    const res = loginAdmin(password.trim());
    if (!res.success) {
      setErrorMsg(res.error || 'Incorrect admin password.');
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setGoogleLoading(true);
    try {
      const res = await signInAdminWithGoogle();
      if (!res.success && res.error) {
        setErrorMsg(res.error);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-sm p-8 shadow-xs text-center animate-in fade-in">
        <InstituteLogo
          className="w-14 h-14 mx-auto mb-4 rounded-xl border border-blue-200 shadow-xs"
          imgClassName="max-h-14 max-w-14 object-contain rounded-xl"
          fallbackType="grid"
        />
        <div className="text-[10px] font-mono tracking-widest text-[#002FA7] uppercase font-bold">
          // ACCESS CONTROL
        </div>
        <h2 className="text-xl font-extrabold text-gray-950 mt-1 mb-2">
          Admin Console Locked
        </h2>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          Faculty authorization required. Sign in with Google Cloud Sync or enter your master administrator password.
        </p>

        <div className="mb-4">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full py-2.5 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold text-xs rounded transition flex items-center justify-center space-x-2 cursor-pointer shadow-2xs disabled:opacity-60"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{googleLoading ? 'Connecting Cloud Sync...' : 'Sign in with Google (Enable Cloud Mobile Sync)'}</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-2 text-gray-400 font-mono">or master password</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4 text-left">
          {errorMsg && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-gray-700">
                Master Password
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                placeholder="Enter password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-[#002FA7]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-[#002FA7] hover:bg-blue-800 text-white font-semibold text-xs rounded transition cursor-pointer shadow-2xs"
          >
            Unlock Admin Console
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setPortalMode('student')}
            className="text-gray-500 hover:text-gray-900 font-medium cursor-pointer"
          >
            ← Student Portal
          </button>
          <button
            type="button"
            onClick={() => setPortalMode('landing')}
            className="text-gray-500 hover:text-gray-900 font-medium cursor-pointer"
          >
            Homepage
          </button>
        </div>
      </div>
    </div>
  );
};

const PortalMainContent: React.FC = () => {
  const { portalMode, activeAdminTab, activeStudentTab, isAdminAuthenticated } = usePortal();

  // 1. Fullscreen Online Exam CBT mode (Zero Share UI / Modal)
  if (portalMode === 'taking_exam') {
    return (
      <>
        <OnlineExamInterface />
        <ToastContainer />
      </>
    );
  }

  // 2. Shared Exam Public Landing page (Screenshot 488)
  if (portalMode === 'public_exam') {
    return (
      <>
        <SharedExamLanding />
        <QuickJoinModal />
        <AuthModal />
        <AdminLoginModal />
        <ToastContainer />
      </>
    );
  }

  // 3. Public Marketing Landing Page (Screenshots 459 - 463)
  if (portalMode === 'landing') {
    return (
      <>
        <LandingPage />
        <AuthModal />
        <AdminLoginModal />
        <ToastContainer />
      </>
    );
  }

  // 4. Split-screen Login Page (Screenshot 464)
  if (portalMode === 'login') {
    return (
      <>
        <LoginView />
        <ToastContainer />
      </>
    );
  }

  // 5. Admin Views switch
  const renderAdminView = () => {
    if (!isAdminAuthenticated) {
      return <AdminAccessGate />;
    }

    switch (activeAdminTab) {
      case 'Dashboard':
        return <AdminDashboard />;
      case 'Students':
        return <StudentsView />;
      case 'Teachers':
        return <TeachersView />;
      case 'Batches':
        return <BatchesView />;
      case 'Question Bank':
        return <QuestionBankView />;
      case 'Exams':
      case 'Exam Management':
        return <ExamManagementView />;
      case 'Create Exam':
        return <CreateExamView />;
      case 'Attendance':
        return <AttendanceView />;
      case 'Study Material':
        return <StudyMaterialView />;
      case 'Notifications':
        return <NotificationsView />;
      case 'Results & Recording':
        return <ResultsRecordingView />;
      case 'Evaluation':
        return <EvaluationView />;
      case 'Payments':
        return <PaymentsView />;
      case 'Courses':
        return <CoursesView />;
      case 'Test Series':
        return <TestSeriesView />;
      case 'Settings':
      case 'Institute Settings':
        return <InstituteSettingsView />;
      default:
        return <AdminDashboard />;
    }
  };

  // 6. Student Views switch
  const renderStudentView = () => {
    switch (activeStudentTab) {
      case 'Dashboard':
        return <StudentDashboard />;
      case 'Exams':
        return <StudentExamsView />;
      case 'Courses':
        return <StudentCoursesView />;
      case 'Test Series':
        return <StudentTestSeriesView />;
      case 'My Purchases':
        return <StudentPurchasesView />;
      case 'Profile':
        return <StudentProfileView />;
      default:
        return <StudentDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row overflow-x-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-white p-3.5 sm:p-6 lg:p-8 w-full max-w-full">
        <div className="max-w-7xl mx-auto">
          {portalMode === 'admin' ? renderAdminView() : renderStudentView()}
        </div>
      </main>

      {/* Global Modals */}
      {isAdminAuthenticated && portalMode === 'admin' && (
        <>
          <ShareExamModal />
          <CreateFolderModal />
          <CreateQuestionModal />
          <ViewQuestionsModal />
        </>
      )}
      <QuickJoinModal />
      <AuthModal />
      <AdminLoginModal />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <PortalProvider>
      <PortalMainContent />
    </PortalProvider>
  );
}
