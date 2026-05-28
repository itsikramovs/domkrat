export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container py-12 min-h-[calc(100vh-200px)] flex items-center justify-center">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
