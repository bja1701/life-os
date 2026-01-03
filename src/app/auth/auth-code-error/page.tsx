import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center border border-zinc-100">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={32} />
        </div>

        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Authentication Failed</h1>
        <p className="text-zinc-500 mb-8">
          We couldn't sign you in. This usually happens if you cancel the login or if you are not an authorized tester.
        </p>

        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-semibold transition-transform active:scale-[0.98]"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="block w-full py-3 text-zinc-500 hover:text-zinc-800 font-medium"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
