export function EuFundingBanner() {
  return (
    <div className="bg-white py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <img
            src="/images/logos/nap-nextgen-eu.jpg"
            alt="Finansē Eiropas Savienība – NextGenerationEU / Nacionālais attīstības plāns 2027"
            className="h-20 md:h-24 w-auto"
          />
          <div className="max-w-2xl space-y-1 text-sm text-gray-700">
            <p>
              Pateicoties Eiropas Savienības finansējumam mēs varējām izstrādāt
              ērtu mājaslapu par uzņēmumu un mūsu produkciju.
            </p>
            <p>Programma: Atbalsts procesu digitalizācijai komercdarbībā.</p>
            <p>Finansējums: atveseļošanas fonds</p>
            <p className="mt-2 text-xs text-gray-500">
              Noslēgts līgums ar LIAA Nr. 9.2-17-L-2025/228
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
