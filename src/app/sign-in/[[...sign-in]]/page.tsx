import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div
            className="w-10 h-10 flex items-center justify-center font-bold text-lg"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-bg)',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: '6px',
                height: '6px',
                backgroundColor: 'var(--color-primary)',
                border: '2px solid var(--color-bg)',
                borderRadius: 0,
              }}
            />
          </div>
          <span
            className="text-2xl font-bold font-mono"
            style={{ color: 'var(--color-primary)' }}
          >
            SmartLink/
          </span>
        </div>
        <SignIn
          appearance={{
            variables: {
              colorPrimary: '#C9FF3D',
              colorBackground: '#14161B',
              colorText: '#E8EAED',
              colorTextSecondary: '#B8BDC7',
              colorInputBackground: '#1A1D24',
              colorInputText: '#E8EAED',
            },
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-lg',
              headerTitle: { color: '#E8EAED' },
              headerSubtitle: { color: '#B8BDC7' },
              formButtonPrimary: { backgroundColor: '#C9FF3D', color: '#0A0B0E' },
              footerActionLink: { color: '#C9FF3D' },
            },
          }}
        />
      </div>
    </div>
  );
}
