export default function Footer() {
  return (
    <footer className="bg-muted border-t border-border py-6 text-center text-sm text-muted-foreground">
      <div className="container mx-auto px-4">
        <p>&copy; {new Date().getFullYear()} RotaCalc. All rights reserved.</p>
        <p className="mt-1">Designed for NHS professionals.</p>
      </div>
    </footer>
  );
}
