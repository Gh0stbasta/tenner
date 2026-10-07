# Gerichtekatalog – Prüfblatt (FOOD-003)

Generiert aus `backend/src/meals/catalog/dishes.ts` (Test `backend/tests/meals-catalog.test.ts`; neu erzeugen mit
`UPDATE_REVIEW_SHEET=1 npx vitest run tests/meals-catalog.test.ts` in `backend/`). Bitte prüfen: Mahlzeit (M = mittags,
A = abends), leicht oder sättigend, Proteinquelle, Grundzutat und aktive Kochzeit. ⚠ = mehr als 20 Minuten aktiv: wird
mit der Standardregel nicht geplant, bis Zeit oder Grenze angepasst sind. Mengen pro Erwachsenenportion stehen im Code.

61 Gerichte.

| Gericht | Mahlzeit | Art | Vegetarisch | Protein | Grundzutat | Minuten aktiv / gesamt | Variante, Hinweise | Zutaten |
|---|---|---|---|---|---|---|---|---|
| Bratkartoffeln mit Ei | M+A | sättigend | ja | – | Kartoffeln | 20 / 30 | – · Gruppe Bratkartoffeln | Kartoffeln, Eier, Zwiebeln, Öl |
| Bratkartoffeln mit Würstl | M+A | sättigend | nein | Würstchen | Kartoffeln | 20 / 30 | – · Gruppe Bratkartoffeln | Kartoffeln, Wiener Würstchen, Zwiebeln, Öl |
| Burger | M+A | sättigend | nein | Burger-Patty | Brot | 15 / 20 | mit Gemüse-Patty · Burger | Burgerbrötchen, Burger-Patties (Rind), Tomaten, Salatmischung, Käsescheiben, Ketchup |
| Burgerwraps | M+A | sättigend | nein | Hack | Brot | 15 / 20 | – · Burger | Weizen-Wraps, Rinderhackfleisch, Tomaten, Salatmischung, Reibekäse, Ketchup |
| Chicken Dinos mit Pommes | M+A | sättigend | nein | Geflügel | Kartoffeln | 5 / 25 | mit Veggie-Nuggets | Chicken Dinos / Nuggets (TK), Pommes (TK), Ketchup |
| Chili | M+A | sättigend | nein | Hack | Reis | 15 / 35 | – | Rinderhackfleisch, Kidneybohnen (Dose), Mais (Dose), Gehackte Tomaten (Dose), Zwiebeln, Reis, Paprikapulver |
| Curryreis mit Kokosmilch (mild) | M+A | leicht | ja | – | Reis | 10 / 25 | – | Reis, Kokosmilch, Gemüsemischung (TK), Erbsen (TK), Currypulver (mild) |
| Eier in Senfsoße mit Kartoffeln | M+A | sättigend | ja | – | Kartoffeln | 20 / 25 | – | Eier, Kartoffeln, Kochsahne, Senf, Mehl, Butter |
| Eierreis mit Gemüse | M+A | leicht | ja | – | Reis | 15 / 25 | – | Reis, Eier, Gemüsemischung (TK), Sojasauce, Frühlingszwiebeln |
| Fischstäbchen mit Erbsenpüree | M+A | sättigend | nein | Fisch | – | 10 / 20 | mit Gemüsestäbchen | Fischstäbchen (TK), Erbsen (TK), Butter, Sahne |
| Fischstäbchen-Auflauf mit Kartoffeln und Spinat | M+A | sättigend | nein | Fisch | Kartoffeln | 15 / 45 | ohne Fischstäbchen, mit Feta | Fischstäbchen (TK), Kartoffeln, Rahmspinat / Blattspinat (TK), Kochsahne, Reibekäse |
| Flammkuchen | M+A | sättigend | ja | – | Brot | 10 / 25 | – | Flammkuchenteig, Crème fraîche, Zwiebeln, Schinkenwürfel (opt.) |
| Frikadellen mit Kartoffelbrei | M+A | sättigend | nein | Hackbällchen | Kartoffeln | 25 ⚠ / 35 | mit Gemüsefrikadellen | Gemischtes Hackfleisch, Eier, Paniermehl, Zwiebeln, Kartoffeln, Milch, Butter |
| Gebratener Halloumi mit Ofengemüse | M+A | leicht | ja | – | Kartoffeln | 15 / 40 | – | Halloumi, Paprika, Zucchini, Karotten, Kartoffeln, Olivenöl |
| Gebratener Lachs mit Gemüse | M+A | leicht | nein | Fisch | Kartoffeln | 15 / 25 | mit Halloumi statt Lachs | Lachsfilet, Brokkoli, Karotten, Kartoffeln, Öl |
| Gemüse-Toasts aus dem Ofen | M+A | leicht | ja | – | Brot | 10 / 20 | – | Toastbrot, Zucchini, Tomaten, Reibekäse |
| Gemüsecurry | M+A | leicht | ja | – | Reis | 15 / 25 | – | Gemüsemischung (TK), Kokosmilch, Currypulver (mild), Reis |
| Gemüsefrikadellen | M+A | sättigend | ja | – | Kartoffeln | 25 ⚠ / 35 | – | Karotten, Zucchini, Eier, Paniermehl, Reibekäse, Kartoffeln |
| Gnocchi in Spinatsoße | M+A | sättigend | ja | – | Gnocchi | 10 / 15 | – · Gruppe Gnocchi | Gnocchi, Rahmspinat / Blattspinat (TK), Kochsahne, Parmesan |
| Gnocchi in Tomatensoße | M+A | leicht | ja | – | Gnocchi | 10 / 15 | – · Gruppe Gnocchi | Gnocchi, Passierte Tomaten, Italienische Kräuter, Mozzarella (opt.) |
| Gnocchi mit Spinat & Feta | M+A | sättigend | ja | – | Gnocchi | 10 / 15 | – · Gruppe Gnocchi | Gnocchi, Rahmspinat / Blattspinat (TK), Feta, Kochsahne |
| Grießbrei | M | sättigend | ja | – | Getreide | 10 / 15 | – | Weichweizengrieß, Milch, Zucker, Butter, Zimtzucker (opt.) |
| Hot Dogs | M+A | sättigend | nein | Würstchen | Brot | 10 / 10 | – | Hot-Dog-Brötchen, Wiener Würstchen, Ketchup, Senf, Röstzwiebeln (opt.) |
| Kaiserschmarrn | M | sättigend | ja | – | – | 20 / 25 | – | Mehl, Eier, Milch, Zucker, Butter, Rosinen (opt.), Apfelmus (opt.), Puderzucker |
| Kartoffelmuffins | M+A | sättigend | ja | – | Kartoffeln | 15 / 40 | – | Kartoffeln, Eier, Reibekäse, Mehl |
| Kartoffeln mit Butter | M+A | leicht | ja | – | Kartoffeln | 5 / 25 | – | Kartoffeln, Butter, Kräuterquark (opt.) |
| Kartoffelpuffer | M+A | sättigend | ja | – | Kartoffeln | 10 / 25 | – | Kartoffelpuffer (TK), Apfelmus (opt.) |
| Kartoffelsuppe mit Würstl | M+A | sättigend | nein | Würstchen | Kartoffeln | 15 / 35 | – | Kartoffeln, Karotten, Zwiebeln, Sahne, Gemüsebrühe (Pulver), Wiener Würstchen |
| Käsemakkaroni | M+A | sättigend | ja | – | Nudeln | 15 / 20 | – | Nudeln, Milch, Reibekäse, Butter, Mehl |
| Käsespätzle mit Röstzwiebeln | M+A | sättigend | ja | – | Nudeln | 15 / 25 | – | Spätzle, Reibekäse, Röstzwiebeln, Butter |
| Kontaktgrill-Sandwiches | M+A | leicht | ja | – | Brot | 10 / 10 | – | Toastbrot, Mozzarella, Tomaten |
| Köttbullar | M+A | sättigend | nein | Hackbällchen | Kartoffeln | 15 / 25 | mit Gemüsebällchen | Köttbullar (TK), Kartoffeln, Kochsahne |
| Lasagne | M+A | sättigend | nein | Hack | Nudeln | 25 ⚠ / 70 | – | Lasagneplatten, Rinderhackfleisch, Passierte Tomaten, Zwiebeln, Milch, Butter, Mehl, Reibekäse |
| Linseneintopf | M+A | leicht | ja | – | Kartoffeln | 15 / 35 | – | Rote Linsen, Karotten, Kartoffeln, Zwiebeln, Gemüsebrühe (Pulver), Tomatenmark |
| Mikrowellenrisotto | M+A | leicht | ja | – | Reis | 5 / 20 | – | Risottoreis, Gemüsebrühe (Pulver), Erbsen (TK), Parmesan, Butter |
| Mozzarella-Tomaten-Baguettes | M+A | leicht | ja | – | Brot | 10 / 20 | – | Aufback-Baguette, Mozzarella, Tomaten, Italienische Kräuter |
| Nudelauflauf | M+A | sättigend | ja | – | Nudeln | 15 / 45 | – | Nudeln, Brokkoli, Kochsahne, Eier, Reibekäse |
| Nudeln mit Soße | M+A | sättigend | ja | – | Nudeln | 10 / 15 | – | Nudeln, Passierte Tomaten, Italienische Kräuter, Parmesan (opt.) |
| Ofengemüse mit Kräuterquark | M+A | leicht | ja | – | Kartoffeln | 10 / 40 | – | Kartoffeln, Paprika, Zucchini, Karotten, Kräuterquark, Olivenöl |
| Ofenrigatoni | M+A | sättigend | ja | – | Nudeln | 15 / 35 | – | Nudeln, Passierte Tomaten, Mozzarella, Reibekäse, Italienische Kräuter |
| One Pot Pasta | M+A | sättigend | ja | – | Nudeln | 10 / 20 | – | Nudeln, Cherrytomaten, Rahmspinat / Blattspinat (TK), Frischkäse, Gemüsebrühe (Pulver) |
| Onigiri | M | leicht | ja | – | Reis | 15 / 35 | – | Sushireis, Nori-Algenblätter, Gurke, Sesam (opt.), Sojasauce (opt.) |
| Pfannenpizza (Wrap-Boden) | M+A | sättigend | ja | – | Brot | 15 / 15 | – | Weizen-Wraps, Passierte Tomaten, Mozzarella, Italienische Kräuter |
| Piratenburger | M+A | sättigend | nein | Burger-Patty | Brot | 15 / 20 | mit Gemüse-Patty · Burger | Burgerbrötchen, Burger-Patties (Rind), Gurke, Käsescheiben, Ketchup |
| Ramen | M+A | leicht | ja | – | Nudeln | 15 / 20 | – | Ramen-Nudeln, Eier, Gemüsemischung (TK), Sojasauce, Gemüsebrühe (Pulver), Frühlingszwiebeln |
| Ravioli | M+A | sättigend | ja | – | Nudeln | 10 / 15 | – | Ravioli, Passierte Tomaten, Parmesan (opt.) |
| Reispfanne mit Paprika & Zucchini | M+A | leicht | ja | – | Reis | 15 / 25 | – | Reis, Paprika, Zucchini, Sojasauce, Öl |
| Rösti mit Kräuterquark | M+A | sättigend | ja | – | Kartoffeln | 10 / 25 | – | Rösti (TK), Kräuterquark |
| Salat mit Ei | M+A | leicht | ja | – | – | 10 / 10 | – · Gruppe Salat mit Protein | Salatmischung, Gurke, Cherrytomaten, Salatdressing, Eier |
| Salat mit Feta | M+A | leicht | ja | – | – | 10 / 10 | – · Gruppe Salat mit Protein | Salatmischung, Gurke, Cherrytomaten, Salatdressing, Feta |
| Salat mit Hähnchen | M+A | leicht | nein | Geflügel | – | 15 / 15 | mit Halloumi statt Hähnchen · Gruppe Salat mit Protein | Salatmischung, Gurke, Cherrytomaten, Salatdressing, Hähnchenbrust |
| Salat mit Halloumi | M+A | leicht | ja | – | – | 10 / 10 | – · Gruppe Salat mit Protein | Salatmischung, Gurke, Cherrytomaten, Salatdressing, Halloumi |
| Salat mit Lachs | M+A | leicht | nein | Fisch | – | 10 / 10 | mit Feta statt Lachs · Gruppe Salat mit Protein | Salatmischung, Gurke, Cherrytomaten, Salatdressing, Lachsfilet |
| Schupfnudeln | M+A | sättigend | ja | – | Schupfnudeln | 10 / 15 | – | Schupfnudeln, Butter, Zwiebeln, Schinkenwürfel (opt.) |
| Spaghetti Bolognese | M+A | sättigend | nein | Hack | Nudeln | 15 / 30 | – | Nudeln, Rinderhackfleisch, Passierte Tomaten, Zwiebeln, Karotten, Tomatenmark, Parmesan (opt.) |
| Spätzle | M+A | sättigend | ja | – | Nudeln | 10 / 15 | – · Gruppe Spätzle | Spätzle, Butter, Erbsen (TK), Parmesan (opt.) |
| Spätzle mit Hackbraten | M+A | sättigend | nein | Hackbällchen | Nudeln | 25 ⚠ / 70 | mit Gemüsebratling · Gruppe Spätzle | Spätzle, Gemischtes Hackfleisch, Eier, Paniermehl, Zwiebeln, Kochsahne |
| Spätzle mit Soße | M+A | sättigend | ja | – | Nudeln | 15 / 20 | – · Gruppe Spätzle | Spätzle, Champignons, Kochsahne, Zwiebeln |
| Toast Hawaii | M+A | sättigend | nein | Schinken | Brot | 10 / 20 | ohne Schinken | Toastbrot, Kochschinken, Ananas (Dose), Käsescheiben |
| Tortellini | M+A | sättigend | ja | – | Nudeln | 10 / 15 | – · Gruppe Tortellini | Tortellini (Käsefüllung), Passierte Tomaten, Parmesan (opt.) |
| Tortellini mit Frischkäsefüllung & Brokkoli | M+A | sättigend | ja | – | Nudeln | 10 / 15 | – · Gruppe Tortellini | Tortellini (Frischkäsefüllung), Brokkoli, Kochsahne, Parmesan |
