import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 logo-gradient rounded-xl flex items-center justify-center text-white font-bold text-lg">
            SL
          </div>
          <span className="text-2xl font-bold font-heading" style={{ color: 'var(--color-text)' }}>
            Smart<span className="font-normal">Link</span>
          </span>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-lg border border-slate-200 rounded-2xl',
            },
          }}
        />
      </div>
    </div>
  );
}
