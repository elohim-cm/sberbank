# Gestion des dossiers KYC

Ouvrir **`/sberbank/admin`**.

## Accès

- Avec `next dev`, sur `localhost` ou `127.0.0.1`, la page est accessible sans
  compte et sans code. Les noms d’hôtes externes ne bénéficient pas de ce mode.
- Sur Vercel, ou avec `next start` en production, définir une variable serveur :

  ```dotenv
  ADMIN_ACCESS_CODE=votre_code_aleatoire_de_16_caracteres_minimum
  ```

  Utiliser idéalement un secret aléatoire de 32 octets :

  ```sh
  node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
  ```

  Ajouter la variable dans Vercel, puis redéployer. Aucun compte administrateur
  n’est nécessaire : saisir ce code sur la page. Le code n’est jamais envoyé dans
  le HTML ni stocké dans le navigateur. Une session signée, `HttpOnly`, `Secure`,
  `SameSite=Strict`, limitée au chemin `/sberbank/admin`, dure huit heures.
  Sans code configuré, l’accès aux données reste fermé en production.

Le bouton de sortie efface la session du navigateur courant. Changer le code et
redéployer invalide toutes les sessions existantes. Il s’agit d’un accès partagé,
pas d’une identification individuelle des opérateurs. La limite globale de
20 essais par tranche de 15 minutes est conservée dans `admin_login_limits` avec
expiration automatique. Des tentatives abusives peuvent donc temporairement
empêcher aussi les connexions légitimes.

## Fonctionnalités

- Recherche par nom, prénom ou e-mail, filtres et pagination de 20 clients.
- Consultation du profil et du solde enregistrés dans MongoDB.
- Photos recto, verso et selfie : aperçu, agrandissement et téléchargement privé.
- Approbation avec confirmation explicite après examen des photos.
- Refus avec motif obligatoire (3 à 500 caractères), affiché au client et envoyé par e-mail en russe. Le client peut ensuite soumettre de nouvelles photos.
- Historique des 20 dernières notifications du client, avec état d’envoi Brevo.
- Crédit du solde d’un client dont le compte et le dossier KYC sont approuvés.
- Historique des dix derniers crédits administrateur : montant, référence, date,
  solde avant et solde après.

Le serveur refuse d’approuver un brouillon ou un dossier auquel manque une photo
obligatoire. Il enregistre dans la **même transaction** le statut `approved` du
compte et du dossier, la date de décision, une entrée `admin_audit` et l’e-mail
`kyc_approved`. Répéter une validation ne crée ni décision ni e-mail supplémentaires.
Seuls les dossiers synthétiques sont approuvés par les tests automatisés.

Le client en attente vérifie le statut toutes les 30 secondes lorsque son onglet
est visible, ainsi qu’au retour dans l’onglet. Après approbation, le dashboard
affiche le statut confirmé et rend accessibles les consultations du solde, des
cartes et des comptes. Il ne fabrique ni coordonnées bancaires, ni historique de
solde, ni service de paiement : ces fonctionnalités nécessitent leurs propres
intégrations. Le refus de KYC et les transferts bancaires externes ne sont pas
ajoutés à cette page.

## Crédit du solde

Dans `/sberbank/admin`, sélectionner un client approuvé, puis utiliser
« Зачислить на баланс ». Saisir un montant positif en RUB (virgule ou point,
deux décimales maximum), vérifier le destinataire et confirmer. La somme
**s’ajoute** au solde ; elle ne le remplace jamais. Le KYC est revérifié côté
serveur au moment de l’opération.

Les calculs utilisent des kopecks entiers. Pour conserver la compatibilité,
`accounts.balance` reste exprimé en RUB. Une transaction MongoDB enregistre
ensemble le nouveau solde, le crédit confirmé dans `incoming_transfers`,
l’audit `balance_credit` et la notification `incoming_transfer`. La source
`admin_credit` distingue cette opération d’un transfert bancaire externe.

L’interface conserve un identifiant d’opération par compte dans le stockage de
session du navigateur. Si une réponse est perdue, répéter la confirmation ou
recharger la page réutilise cet identifiant. L’index unique empêche un second
crédit de la même opération. Les crédits distincts simultanés s’additionnent
dans des transactions avec reprise sur conflit, sans écraser le solde précédent.

L’envoi SMTP de cette notification démarre après le commit, en ciblant cet
événement même si d’anciens e-mails attendent déjà en file. Une indisponibilité
de Brevo laisse le crédit enregistré et l’e-mail en attente de reprise ; elle ne
réexécute jamais le crédit. « Notification en file » ne signifie pas livraison
effective en boîte de réception. Le dashboard client relit aussi le solde
toutes les 30 secondes lorsque l’onglet est visible, et au retour dans l’onglet.

Les crédits confirmés, y compris ceux déjà enregistrés, figurent aussi dans
« Операции » côté client. L’accueil montre les cinq dernières opérations ;
l’historique complet se charge par pages de 20. La route `/api/account/operations`
utilise exclusivement le compte de la session, sans accepter de compte cible.
Les montants, dates et statuts sont visibles ; les références internes et les
données d’administration ne sont pas exposées. Modifier directement `balance`
dans MongoDB ne crée pas une opération d’historique.

Les routes d’administration vérifient l’accès côté serveur, y compris pour
chaque photo. Les images et réponses contenant des données clients utilisent
`Cache-Control: private, no-store`. Les modifications exigent aussi une origine
identique au site. Les images ne passent jamais par l’optimiseur partagé de Next.
La page est exclue de l’indexation et n’est pas liée depuis le site public.

## Tests

```sh
node tests/admin-access.mjs
node tests/money.mjs
node tests/brevo.mjs
npm run build
node tests/atlas-admin.mjs
```

Le dernier test nécessite le serveur de développement sur le port 3000. Il lance
un serveur de production temporaire sur `127.0.0.1:3002`, avec un code aléatoire
propre au test. Il crée deux comptes et des images synthétiques, contrôle les
droits d’accès, les téléchargements, l’approbation, les crédits exacts, les
confirmations répétées et les ajouts simultanés, puis supprime uniquement
ses propres comptes, photos, crédits, notifications et entrées d’audit. Les e-mails de
test `.invalid` ne sont jamais transmis à Brevo. Aucun dossier existant n’est
validé ou modifié par le test.

Pour inclure les interactions réelles dans Chrome ou Edge (recherche, sélection,
aperçu des photos, confirmation et largeurs 1440/390 pixels), lancer ce dernier
test avec `ADMIN_BROWSER_TEST=1`. Les captures sont enregistrées dans le dossier
local `verification/`, ignoré par Git, et montrent uniquement des photos synthétiques.
