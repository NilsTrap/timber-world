-- Product Texts Translations
-- Created: 2026-04-19
-- Inserts translated product texts for all non-English locales.
-- Uses ON CONFLICT to upsert so this migration is idempotent.
--
-- Current English product texts (after 20260301000014_update_product_texts.sql):
--   product-1: Oak Stair Cladding
--   product-2: Oak Stair Renovation Set
--   product-3: Oak Handrails
--   product-4: Oak Beams for Central Spine or Floating Staircases
--   product-5: CNC Machined Oak Stair Parts
--   product-6: Oak Treads
--   product-7: Oak Solid Wood Panels
--   product-8..10: Coming Soon

INSERT INTO marketing_texts (category, section, key, locale, value, sort_order)
VALUES

-- ============================================================
-- FINNISH (fi)
-- ============================================================

-- Product 1: Oak Stair Cladding
('products', 'product-1', 'title', 'fi', 'Tammiportaiden verhoilu', 1),
('products', 'product-1', 'description', 'fi', 'Uudista olemassa olevat portaasi laadukkaalla tammiverhoilujärjestelmällä. Kustannustehokas tapa saavuttaa upea massiivitammen ilme ilman koko portaikon vaihtoa.', 2),
('products', 'product-1', 'specification', 'fi', '', 3),

-- Product 2: Oak Stair Renovation Set
('products', 'product-2', 'title', 'fi', 'Tammiportaiden kunnostussarja', 3),
('products', 'product-2', 'description', 'fi', 'Täydelliset kunnostussarjat sisältäen askelmat, nousulevyt ja reunalistat. Kaikki mitä tarvitset portaikkosi päivittämiseen kauniiksi massiivitammeksi.', 4),
('products', 'product-2', 'specification', 'fi', '', 5),

-- Product 3: Oak Handrails
('products', 'product-3', 'title', 'fi', 'Tammikäsijohteet', 5),
('products', 'product-3', 'description', 'fi', 'Elegantisti profiloidut tammikäsijohteet eri tyyleissä ja mitoissa. Sileitä kosketukselle ja luonnollisen lämpimiä, täydentävät jokaista sisustusta.', 6),
('products', 'product-3', 'specification', 'fi', '', 7),

-- Product 4: Oak Beams
('products', 'product-4', 'title', 'fi', 'Tammipalkit keskiselkäranka- ja kelluville portaille', 7),
('products', 'product-4', 'description', 'fi', 'Rakenteelliset tammipalkit moderneihin porrasratkaisuihin. Täydellisiä näyttävien kelluvien portaiden tai keskiselkärankarakenteiden luomiseen.', 8),
('products', 'product-4', 'specification', 'fi', '', 9),

-- Product 5: CNC Machined Oak Stair Parts
('products', 'product-5', 'title', 'fi', 'CNC-työstetyt tammiporrasosat', 9),
('products', 'product-5', 'description', 'fi', 'Tarkasti valmistetut tammikomponentit mittatilaustyönä. Mukautetut profiilit, monimutkaiset muodot ja tiukat toleranssit edistyneellä CNC-teknologialla.', 10),
('products', 'product-5', 'specification', 'fi', '', 11),

-- Product 6: Oak Treads
('products', 'product-6', 'title', 'fi', 'Tammiaskelmat', 11),
('products', 'product-6', 'description', 'fi', 'Massiivitammiset porrasaskelmat vakio- ja mittatilauskoossa. Valitse sormijatkos- tai kokolamellirakenteesta eri reunaprofiileilla.', 12),
('products', 'product-6', 'specification', 'fi', '', 13),

-- Product 7: Oak Solid Wood Panels
('products', 'product-7', 'title', 'fi', 'Massiivitammipaneelit', 13),
('products', 'product-7', 'description', 'fi', 'Laadukkaat tammipaneelit huonekaluihin, työtasoihin, hyllyihin ja arkkitehtuurisovelluksiin. Saatavilla eri paksuuksissa, leveyksissa ja laatuluokissa.', 14),
('products', 'product-7', 'specification', 'fi', '', 15),

-- Product 8: Coming Soon
('products', 'product-8', 'title', 'fi', 'Tulossa pian', 15),
('products', 'product-8', 'description', 'fi', 'Uusi tuote tulossa pian. Tarkista myöhemmin päivitykset.', 16),
('products', 'product-8', 'specification', 'fi', '', 17),

-- Product 9: Coming Soon
('products', 'product-9', 'title', 'fi', 'Tulossa pian', 17),
('products', 'product-9', 'description', 'fi', 'Uusi tuote tulossa pian. Tarkista myöhemmin päivitykset.', 18),
('products', 'product-9', 'specification', 'fi', '', 19),

-- Product 10: Coming Soon
('products', 'product-10', 'title', 'fi', 'Tulossa pian', 19),
('products', 'product-10', 'description', 'fi', 'Uusi tuote tulossa pian. Tarkista myöhemmin päivitykset.', 20),
('products', 'product-10', 'specification', 'fi', '', 21),

-- ============================================================
-- SWEDISH (sv)
-- ============================================================

-- Product 1: Oak Stair Cladding
('products', 'product-1', 'title', 'sv', 'Trappbeklädnad i ek', 1),
('products', 'product-1', 'description', 'sv', 'Förvandla dina befintliga trappor med vårt premiumsystem för ekbeklädnad. Ett kostnadseffektivt sätt att uppnå en fantastisk massiv ekfinish utan att byta hela trappan.', 2),
('products', 'product-1', 'specification', 'sv', '', 3),

-- Product 2: Oak Stair Renovation Set
('products', 'product-2', 'title', 'sv', 'Trapprenoveringssats i ek', 3),
('products', 'product-2', 'description', 'sv', 'Kompletta renoveringssatser inklusive plansteg, sättsteg och nosar. Allt du behöver för att uppgradera din trappa till vacker massiv ek.', 4),
('products', 'product-2', 'specification', 'sv', '', 5),

-- Product 3: Oak Handrails
('products', 'product-3', 'title', 'sv', 'Ekhandledare', 5),
('products', 'product-3', 'description', 'sv', 'Elegant profilerade ekhandledare i olika stilar och dimensioner. Mjuka att ta i med en naturlig värme som kompletterar varje interiör.', 6),
('products', 'product-3', 'specification', 'sv', '', 7),

-- Product 4: Oak Beams
('products', 'product-4', 'title', 'sv', 'Ekbalkar för centralbalk- eller svävande trappor', 7),
('products', 'product-4', 'description', 'sv', 'Strukturella ekbalkar konstruerade för moderna trappdesigner. Perfekta för att skapa slående svävande trappor eller centralbalkskonfigurationer.', 8),
('products', 'product-4', 'specification', 'sv', '', 9),

-- Product 5: CNC Machined Oak Stair Parts
('products', 'product-5', 'title', 'sv', 'CNC-bearbetade trappdelar i ek', 9),
('products', 'product-5', 'description', 'sv', 'Precisionsbearbetade ekkomponenter tillverkade efter dina exakta specifikationer. Anpassade profiler, komplexa former och snäva toleranser med avancerad CNC-teknik.', 10),
('products', 'product-5', 'specification', 'sv', '', 11),

-- Product 6: Oak Treads
('products', 'product-6', 'title', 'sv', 'Ekplansteg', 11),
('products', 'product-6', 'description', 'sv', 'Massiva ekplansteg i standard- och specialstorlekar. Välj mellan fingerskarvad eller helvirkeskonstruktion med olika kantprofiler.', 12),
('products', 'product-6', 'specification', 'sv', '', 13),

-- Product 7: Oak Solid Wood Panels
('products', 'product-7', 'title', 'sv', 'Massiva ekpaneler', 13),
('products', 'product-7', 'description', 'sv', 'Premiumpaneler i ek för möbler, bänkskivor, hyllor och arkitektoniska tillämpningar. Finns i olika tjocklekar, bredder och kvalitetsklasser.', 14),
('products', 'product-7', 'specification', 'sv', '', 15),

-- Product 8: Coming Soon
('products', 'product-8', 'title', 'sv', 'Kommer snart', 15),
('products', 'product-8', 'description', 'sv', 'Ny produkt kommer snart. Kom tillbaka för uppdateringar.', 16),
('products', 'product-8', 'specification', 'sv', '', 17),

-- Product 9: Coming Soon
('products', 'product-9', 'title', 'sv', 'Kommer snart', 17),
('products', 'product-9', 'description', 'sv', 'Ny produkt kommer snart. Kom tillbaka för uppdateringar.', 18),
('products', 'product-9', 'specification', 'sv', '', 19),

-- Product 10: Coming Soon
('products', 'product-10', 'title', 'sv', 'Kommer snart', 19),
('products', 'product-10', 'description', 'sv', 'Ny produkt kommer snart. Kom tillbaka för uppdateringar.', 20),
('products', 'product-10', 'specification', 'sv', '', 21),

-- ============================================================
-- NORWEGIAN (no)
-- ============================================================

-- Product 1: Oak Stair Cladding
('products', 'product-1', 'title', 'no', 'Trappekledning i eik', 1),
('products', 'product-1', 'description', 'no', 'Forvandle dine eksisterende trapper med vårt premiumsystem for eikekledning. En kostnadseffektiv måte å oppnå et fantastisk heltre eik-utseende uten å bytte hele trappen.', 2),
('products', 'product-1', 'specification', 'no', '', 3),

-- Product 2: Oak Stair Renovation Set
('products', 'product-2', 'title', 'no', 'Trapperenoveringssett i eik', 3),
('products', 'product-2', 'description', 'no', 'Komplette renoveringssett inkludert trinn, stusstrinn og neser. Alt du trenger for å oppgradere trappen din til vakker heltre eik.', 4),
('products', 'product-2', 'specification', 'no', '', 5),

-- Product 3: Oak Handrails
('products', 'product-3', 'title', 'no', 'Håndløpere i eik', 5),
('products', 'product-3', 'description', 'no', 'Elegant profilert eik-håndløpere i ulike stiler og dimensjoner. Glatte å ta på med en naturlig varme som komplementerer ethvert interiør.', 6),
('products', 'product-3', 'specification', 'no', '', 7),

-- Product 4: Oak Beams
('products', 'product-4', 'title', 'no', 'Eikebjelker for sentralbjelke- eller svevende trapper', 7),
('products', 'product-4', 'description', 'no', 'Strukturelle eikebjelker konstruert for moderne trappedesign. Perfekte for å skape slående svevende trapper eller sentralbjelkekonfigurasjoner.', 8),
('products', 'product-4', 'specification', 'no', '', 9),

-- Product 5: CNC Machined Oak Stair Parts
('products', 'product-5', 'title', 'no', 'CNC-maskinerte trappedeler i eik', 9),
('products', 'product-5', 'description', 'no', 'Presisjonsmaskinerte eikekomponenter laget etter dine nøyaktige spesifikasjoner. Tilpassede profiler, komplekse former og stramme toleranser med avansert CNC-teknologi.', 10),
('products', 'product-5', 'specification', 'no', '', 11),

-- Product 6: Oak Treads
('products', 'product-6', 'title', 'no', 'Eiketrinn', 11),
('products', 'product-6', 'description', 'no', 'Solide eik-trappetrinn i standard- og spesialstørrelser. Velg mellom fingerskjøtet eller helvirkeskonstruksjon med ulike kantprofiler.', 12),
('products', 'product-6', 'specification', 'no', '', 13),

-- Product 7: Oak Solid Wood Panels
('products', 'product-7', 'title', 'no', 'Massive eikepaneler', 13),
('products', 'product-7', 'description', 'no', 'Premium eikepaneler for møbler, benkeplater, hyller og arkitektoniske applikasjoner. Tilgjengelig i ulike tykkelser, bredder og kvalitetsgrader.', 14),
('products', 'product-7', 'specification', 'no', '', 15),

-- Product 8: Coming Soon
('products', 'product-8', 'title', 'no', 'Kommer snart', 15),
('products', 'product-8', 'description', 'no', 'Nytt produkt kommer snart. Kom tilbake for oppdateringer.', 16),
('products', 'product-8', 'specification', 'no', '', 17),

-- Product 9: Coming Soon
('products', 'product-9', 'title', 'no', 'Kommer snart', 17),
('products', 'product-9', 'description', 'no', 'Nytt produkt kommer snart. Kom tilbake for oppdateringer.', 18),
('products', 'product-9', 'specification', 'no', '', 19),

-- Product 10: Coming Soon
('products', 'product-10', 'title', 'no', 'Kommer snart', 19),
('products', 'product-10', 'description', 'no', 'Nytt produkt kommer snart. Kom tilbake for oppdateringer.', 20),
('products', 'product-10', 'specification', 'no', '', 21),

-- ============================================================
-- DANISH (da)
-- ============================================================

-- Product 1: Oak Stair Cladding
('products', 'product-1', 'title', 'da', 'Trappebeklædning i eg', 1),
('products', 'product-1', 'description', 'da', 'Forvandle dine eksisterende trapper med vores premiumsystem til egebeklædning. En omkostningseffektiv måde at opnå et flot massivt ege-look uden at udskifte hele trappen.', 2),
('products', 'product-1', 'specification', 'da', '', 3),

-- Product 2: Oak Stair Renovation Set
('products', 'product-2', 'title', 'da', 'Trapperenoveringssæt i eg', 3),
('products', 'product-2', 'description', 'da', 'Komplette renoveringssæt inklusive trappetrin, stødtrin og næser. Alt hvad du behøver for at opgradere din trappe til smuk massiv eg.', 4),
('products', 'product-2', 'specification', 'da', '', 5),

-- Product 3: Oak Handrails
('products', 'product-3', 'title', 'da', 'Egehåndlister', 5),
('products', 'product-3', 'description', 'da', 'Elegant profilerede egehåndlister i forskellige stilarter og dimensioner. Glatte at røre ved med en naturlig varme der komplementerer ethvert interiør.', 6),
('products', 'product-3', 'specification', 'da', '', 7),

-- Product 4: Oak Beams
('products', 'product-4', 'title', 'da', 'Egebjælker til centralbjælke- eller svævetrapper', 7),
('products', 'product-4', 'description', 'da', 'Strukturelle egebjælker konstrueret til moderne trappedesigns. Perfekte til at skabe slående svævetrapper eller centralbjælkekonfigurationer.', 8),
('products', 'product-4', 'specification', 'da', '', 9),

-- Product 5: CNC Machined Oak Stair Parts
('products', 'product-5', 'title', 'da', 'CNC-bearbejdede trappedele i eg', 9),
('products', 'product-5', 'description', 'da', 'Præcisionsfremstillede egekomponenter lavet efter dine nøjagtige specifikationer. Tilpassede profiler, komplekse former og stramme tolerancer med avanceret CNC-teknologi.', 10),
('products', 'product-5', 'specification', 'da', '', 11),

-- Product 6: Oak Treads
('products', 'product-6', 'title', 'da', 'Egetrappetrin', 11),
('products', 'product-6', 'description', 'da', 'Massive egetrappetrin i standard- og specialstørrelser. Vælg mellem fingertappet eller helstavskonstruktion med forskellige kantprofiler.', 12),
('products', 'product-6', 'specification', 'da', '', 13),

-- Product 7: Oak Solid Wood Panels
('products', 'product-7', 'title', 'da', 'Massive egepaneler', 13),
('products', 'product-7', 'description', 'da', 'Premium egepaneler til møbler, bordplader, hylder og arkitektoniske anvendelser. Fås i forskellige tykkelser, bredder og kvalitetsgrader.', 14),
('products', 'product-7', 'specification', 'da', '', 15),

-- Product 8: Coming Soon
('products', 'product-8', 'title', 'da', 'Kommer snart', 15),
('products', 'product-8', 'description', 'da', 'Nyt produkt kommer snart. Kig forbi igen for opdateringer.', 16),
('products', 'product-8', 'specification', 'da', '', 17),

-- Product 9: Coming Soon
('products', 'product-9', 'title', 'da', 'Kommer snart', 17),
('products', 'product-9', 'description', 'da', 'Nyt produkt kommer snart. Kig forbi igen for opdateringer.', 18),
('products', 'product-9', 'specification', 'da', '', 19),

-- Product 10: Coming Soon
('products', 'product-10', 'title', 'da', 'Kommer snart', 19),
('products', 'product-10', 'description', 'da', 'Nyt produkt kommer snart. Kig forbi igen for opdateringer.', 20),
('products', 'product-10', 'specification', 'da', '', 21),

-- ============================================================
-- DUTCH (nl)
-- ============================================================

-- Product 1: Oak Stair Cladding
('products', 'product-1', 'title', 'nl', 'Eiken trapbekleding', 1),
('products', 'product-1', 'description', 'nl', 'Transformeer uw bestaande trap met ons premium eiken bekledingssysteem. Een kosteneffectieve manier om een prachtige massief eiken uitstraling te bereiken zonder de hele trap te vervangen.', 2),
('products', 'product-1', 'specification', 'nl', '', 3),

-- Product 2: Oak Stair Renovation Set
('products', 'product-2', 'title', 'nl', 'Eiken traprenovatieset', 3),
('products', 'product-2', 'description', 'nl', 'Complete renovatiesets inclusief treden, stootborden en neuzen. Alles wat u nodig heeft om uw trap te upgraden naar prachtig massief eiken.', 4),
('products', 'product-2', 'specification', 'nl', '', 5),

-- Product 3: Oak Handrails
('products', 'product-3', 'title', 'nl', 'Eiken trapleuningen', 5),
('products', 'product-3', 'description', 'nl', 'Elegant geprofileerde eiken trapleuningen in diverse stijlen en afmetingen. Glad aanvoelend met een natuurlijke warmte die elk interieur complementeert.', 6),
('products', 'product-3', 'specification', 'nl', '', 7),

-- Product 4: Oak Beams
('products', 'product-4', 'title', 'nl', 'Eiken balken voor middenbalk- of zwevende trappen', 7),
('products', 'product-4', 'description', 'nl', 'Constructieve eiken balken ontworpen voor moderne trapdesigns. Perfect voor het creëren van opvallende zwevende trappen of middenbalkconfiguraties.', 8),
('products', 'product-4', 'specification', 'nl', '', 9),

-- Product 5: CNC Machined Oak Stair Parts
('products', 'product-5', 'title', 'nl', 'CNC-gefreesde eiken traponderdelen', 9),
('products', 'product-5', 'description', 'nl', 'Precisie-gefreesde eiken componenten op maat gemaakt. Aangepaste profielen, complexe vormen en nauwe toleranties met geavanceerde CNC-technologie.', 10),
('products', 'product-5', 'specification', 'nl', '', 11),

-- Product 6: Oak Treads
('products', 'product-6', 'title', 'nl', 'Eiken traptreden', 11),
('products', 'product-6', 'description', 'nl', 'Massief eiken traptreden in standaard- en maatmaten. Kies uit vingergelaste of volledige lamelconstructie met diverse randprofielen.', 12),
('products', 'product-6', 'specification', 'nl', '', 13),

-- Product 7: Oak Solid Wood Panels
('products', 'product-7', 'title', 'nl', 'Massief eiken panelen', 13),
('products', 'product-7', 'description', 'nl', 'Premium eiken panelen voor meubels, werkbladen, planken en architecturale toepassingen. Verkrijgbaar in diverse diktes, breedtes en kwaliteitsklassen.', 14),
('products', 'product-7', 'specification', 'nl', '', 15),

-- Product 8: Coming Soon
('products', 'product-8', 'title', 'nl', 'Binnenkort beschikbaar', 15),
('products', 'product-8', 'description', 'nl', 'Nieuw product binnenkort beschikbaar. Kom later terug voor updates.', 16),
('products', 'product-8', 'specification', 'nl', '', 17),

-- Product 9: Coming Soon
('products', 'product-9', 'title', 'nl', 'Binnenkort beschikbaar', 17),
('products', 'product-9', 'description', 'nl', 'Nieuw product binnenkort beschikbaar. Kom later terug voor updates.', 18),
('products', 'product-9', 'specification', 'nl', '', 19),

-- Product 10: Coming Soon
('products', 'product-10', 'title', 'nl', 'Binnenkort beschikbaar', 19),
('products', 'product-10', 'description', 'nl', 'Nieuw product binnenkort beschikbaar. Kom later terug voor updates.', 20),
('products', 'product-10', 'specification', 'nl', '', 21),

-- ============================================================
-- GERMAN (de)
-- ============================================================

-- Product 1: Oak Stair Cladding
('products', 'product-1', 'title', 'de', 'Eiche-Treppenverkleidung', 1),
('products', 'product-1', 'description', 'de', 'Verwandeln Sie Ihre bestehende Treppe mit unserem Premium-Verkleidungssystem aus Eiche. Eine kostengünstige Möglichkeit, eine beeindruckende Massivholz-Eichenoptik zu erzielen, ohne die gesamte Treppe zu ersetzen.', 2),
('products', 'product-1', 'specification', 'de', '', 3),

-- Product 2: Oak Stair Renovation Set
('products', 'product-2', 'title', 'de', 'Eiche-Treppenrenovierungsset', 3),
('products', 'product-2', 'description', 'de', 'Komplette Renovierungssets mit Trittstufen, Setzstufen und Nasen. Alles, was Sie benötigen, um Ihre Treppe zu schönem Massiveichenholz aufzuwerten.', 4),
('products', 'product-2', 'specification', 'de', '', 5),

-- Product 3: Oak Handrails
('products', 'product-3', 'title', 'de', 'Eiche-Handläufe', 5),
('products', 'product-3', 'description', 'de', 'Elegant profilierte Eiche-Handläufe in verschiedenen Stilrichtungen und Abmessungen. Glatt in der Berührung mit einer natürlichen Wärme, die jedes Interieur ergänzt.', 6),
('products', 'product-3', 'specification', 'de', '', 7),

-- Product 4: Oak Beams
('products', 'product-4', 'title', 'de', 'Eichebalken für Mittelholm- oder Kragarmtreppen', 7),
('products', 'product-4', 'description', 'de', 'Tragende Eichebalken für moderne Treppendesigns. Perfekt für die Gestaltung beeindruckender Kragarmtreppen oder Mittelholmkonfigurationen.', 8),
('products', 'product-4', 'specification', 'de', '', 9),

-- Product 5: CNC Machined Oak Stair Parts
('products', 'product-5', 'title', 'de', 'CNC-gefräste Eiche-Treppenteile', 9),
('products', 'product-5', 'description', 'de', 'Präzisionsgefertigte Eichenkomponenten nach Ihren exakten Vorgaben. Individuelle Profile, komplexe Formen und enge Toleranzen mit modernster CNC-Technologie.', 10),
('products', 'product-5', 'specification', 'de', '', 11),

-- Product 6: Oak Treads
('products', 'product-6', 'title', 'de', 'Eiche-Trittstufen', 11),
('products', 'product-6', 'description', 'de', 'Massive Eiche-Trittstufen in Standard- und Sondergrößen. Wählen Sie zwischen Keilzinken- oder Vollholzkonstruktion mit verschiedenen Kantenprofilen.', 12),
('products', 'product-6', 'specification', 'de', '', 13),

-- Product 7: Oak Solid Wood Panels
('products', 'product-7', 'title', 'de', 'Massivholzplatten aus Eiche', 13),
('products', 'product-7', 'description', 'de', 'Hochwertige Eichenplatten für Möbel, Arbeitsplatten, Regale und architektonische Anwendungen. Erhältlich in verschiedenen Stärken, Breiten und Qualitätsstufen.', 14),
('products', 'product-7', 'specification', 'de', '', 15),

-- Product 8: Coming Soon
('products', 'product-8', 'title', 'de', 'Demnächst verfügbar', 15),
('products', 'product-8', 'description', 'de', 'Neues Produkt demnächst verfügbar. Schauen Sie später vorbei für Updates.', 16),
('products', 'product-8', 'specification', 'de', '', 17),

-- Product 9: Coming Soon
('products', 'product-9', 'title', 'de', 'Demnächst verfügbar', 17),
('products', 'product-9', 'description', 'de', 'Neues Produkt demnächst verfügbar. Schauen Sie später vorbei für Updates.', 18),
('products', 'product-9', 'specification', 'de', '', 19),

-- Product 10: Coming Soon
('products', 'product-10', 'title', 'de', 'Demnächst verfügbar', 19),
('products', 'product-10', 'description', 'de', 'Neues Produkt demnächst verfügbar. Schauen Sie später vorbei für Updates.', 20),
('products', 'product-10', 'specification', 'de', '', 21),

-- ============================================================
-- SPANISH (es)
-- ============================================================

-- Product 1: Oak Stair Cladding
('products', 'product-1', 'title', 'es', 'Revestimiento de escaleras en roble', 1),
('products', 'product-1', 'description', 'es', 'Transforme sus escaleras existentes con nuestro sistema premium de revestimiento en roble. Una forma rentable de lograr un impresionante acabado en roble macizo sin reemplazar toda la escalera.', 2),
('products', 'product-1', 'specification', 'es', '', 3),

-- Product 2: Oak Stair Renovation Set
('products', 'product-2', 'title', 'es', 'Kit de renovación de escaleras en roble', 3),
('products', 'product-2', 'description', 'es', 'Kits de renovación completos que incluyen peldaños, contrahuellas y narices. Todo lo que necesita para renovar su escalera con hermoso roble macizo.', 4),
('products', 'product-2', 'specification', 'es', '', 5),

-- Product 3: Oak Handrails
('products', 'product-3', 'title', 'es', 'Pasamanos de roble', 5),
('products', 'product-3', 'description', 'es', 'Pasamanos de roble elegantemente perfilados en diversos estilos y dimensiones. Suaves al tacto con una calidez natural que complementa cualquier interior.', 6),
('products', 'product-3', 'specification', 'es', '', 7),

-- Product 4: Oak Beams
('products', 'product-4', 'title', 'es', 'Vigas de roble para escaleras centrales o flotantes', 7),
('products', 'product-4', 'description', 'es', 'Vigas estructurales de roble diseñadas para escaleras modernas. Perfectas para crear impresionantes escaleras flotantes o configuraciones de viga central.', 8),
('products', 'product-4', 'specification', 'es', '', 9),

-- Product 5: CNC Machined Oak Stair Parts
('products', 'product-5', 'title', 'es', 'Piezas de escalera en roble mecanizadas por CNC', 9),
('products', 'product-5', 'description', 'es', 'Componentes de roble fabricados con precisión según sus especificaciones exactas. Perfiles personalizados, formas complejas y tolerancias ajustadas con tecnología CNC avanzada.', 10),
('products', 'product-5', 'specification', 'es', '', 11),

-- Product 6: Oak Treads
('products', 'product-6', 'title', 'es', 'Peldaños de roble', 11),
('products', 'product-6', 'description', 'es', 'Peldaños macizos de roble en tamaños estándar y personalizados. Elija entre construcción con unión finger joint o duela completa con diversos perfiles de canto.', 12),
('products', 'product-6', 'specification', 'es', '', 13),

-- Product 7: Oak Solid Wood Panels
('products', 'product-7', 'title', 'es', 'Paneles de roble macizo', 13),
('products', 'product-7', 'description', 'es', 'Paneles premium de roble para muebles, encimeras, estanterías y aplicaciones arquitectónicas. Disponibles en diversos espesores, anchos y grados de calidad.', 14),
('products', 'product-7', 'specification', 'es', '', 15),

-- Product 8: Coming Soon
('products', 'product-8', 'title', 'es', 'Próximamente', 15),
('products', 'product-8', 'description', 'es', 'Nuevo producto próximamente. Vuelva más tarde para ver las novedades.', 16),
('products', 'product-8', 'specification', 'es', '', 17),

-- Product 9: Coming Soon
('products', 'product-9', 'title', 'es', 'Próximamente', 17),
('products', 'product-9', 'description', 'es', 'Nuevo producto próximamente. Vuelva más tarde para ver las novedades.', 18),
('products', 'product-9', 'specification', 'es', '', 19),

-- Product 10: Coming Soon
('products', 'product-10', 'title', 'es', 'Próximamente', 19),
('products', 'product-10', 'description', 'es', 'Nuevo producto próximamente. Vuelva más tarde para ver las novedades.', 20),
('products', 'product-10', 'specification', 'es', '', 21)

ON CONFLICT (category, section, key, locale)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
