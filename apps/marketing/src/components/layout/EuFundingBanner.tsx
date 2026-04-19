export function EuFundingBanner() {
  return (
    <div className="bg-white py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <img
            src="/images/logos/ES-logo_eng.jpeg"
            alt="Funded by the European Union – NextGenerationEU / National Development Plan 2027"
            className="h-20 md:h-24 w-auto"
          />
          <div className="max-w-2xl space-y-1 text-sm text-gray-700">
            <p>
              This project has been implemented with the support of the European
              Union under the Recovery and Resilience Facility (Recovery Fund).
            </p>
            <p>
              As part of the programme &ldquo;Support for Digitalisation of
              Business Processes&rdquo;, a user-friendly website presenting the
              company and its products has been developed.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Contract with the Investment and Development Agency of Latvia
              (LIAA) No. 9.2-17-L-2025/228
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
