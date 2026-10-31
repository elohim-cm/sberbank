# Notifications transactionnelles Brevo

Le serveur Next.js envoie directement par le relais **SMTP Brevo** avec Nodemailer,
sans passer par Gmail ou Outlook. Les cinq e-mails sont rédigés en russe, avec une version
HTML et une version texte. Ils ne contiennent aucune pièce d’identité ni selfie.

## Variables

Ajouter à `.env.local` (jamais à une variable `NEXT_PUBLIC_*`) :

```dotenv
BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_LOGIN=votre_identifiant_smtp_brevo
BREVO_SMTP_KEY=votre_cle_smtp_brevo
BREVO_SENDER_EMAIL=notifications@votre-domaine.com
BREVO_SENDER_NAME="Nom de votre banque"
APP_URL=http://localhost:3000
CRON_SECRET=une_valeur_aleatoire_de_32_caracteres_minimum
```

En production, `APP_URL` doit être l’URL HTTPS officielle du site. Déclarer toutes
ces variables dans les paramètres du projet Vercel, puis redéployer : le fichier
local n’est pas envoyé par Git. Générer le secret, par exemple avec :

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Dans Brevo, récupérer l’**identifiant SMTP** et créer une **clé SMTP**, pas une clé
API ni un mot de passe de boîte mail. `BREVO_API_KEY` n’est plus utilisé et peut
être retiré des variables locales et Vercel. Valider l’expéditeur et
authentifier son domaine selon les instructions Brevo. Le compte Brevo doit
autoriser les e-mails transactionnels. Aucun modèle Brevo à créer : les contenus
sont dans `src/lib/server/brevo.ts`.

Le port `587` exige STARTTLS. Le port `2525` exige également STARTTLS ; le port
`465` utilise TLS dès la connexion. Le certificat du serveur est vérifié et TLS
1.2 minimum est exigé ; aucun envoi en clair n’est autorisé. Le nom de serveur
accepté est `smtp-relay.brevo.com`. L’identifiant `…@smtp-brevo.com` authentifie
la connexion ; `BREVO_SENDER_EMAIL` reste l’adresse validée affichée au client.
Les connexions ne sont pas mises en pool afin de convenir aux fonctions Vercel.

## Déclencheurs

| Événement | Fonctionnement |
| --- | --- |
| Création du compte | Notification enregistrée dans la transaction créant le compte et la session. Envoi après la réponse HTTP. |
| Réception du KYC | Notification enregistrée lorsque toutes les photos sont présentes et que le dossier passe à `pending`. Envoi après la réponse HTTP. |
| KYC approuvé | Relié à l’approbation dans `/sberbank/admin`. Exige un dossier réellement marqué `approved`, un `approvedAt` de type Date et un compte avec `kycStatus: "approved"`. |
| KYC refusé | Relié au refus dans `/sberbank/admin`. Exige une décision `rejected`, une date et un motif de 3 à 500 caractères. Le motif est conservé dans l’e-mail, même si le client dépose ensuite un nouveau dossier. |
| Crédit / virement reçu | Relié au crédit administrateur d’un compte approuvé, enregistré dans `incoming_transfers`. Une modification directe de `balance` dans MongoDB ne déclenche pas d’e-mail. Le même déclencheur pourra servir aux futurs virements bancaires confirmés. |

L’approbation administrative du KYC est disponible dans `/sberbank/admin`, avec
un accès local libre et un code obligatoire en production : voir
[ADMIN-SETUP.md](ADMIN-SETUP.md). Les trois premiers événements sont reliés aux
parcours existants. Le crédit interne du solde par l’administrateur est également
relié à l’envoi de notification. Le traitement bancaire externe des virements
reste à implémenter ; son déclencheur attendra un crédit réellement confirmé.

Contrat d’un virement **déjà confirmé** dans `incoming_transfers` :

```typescript
{
  _id: ObjectId,
  accountId: ObjectId,
  status: "confirmed",
  amountMinor: 125050, // 1 250,50 RUB, entier en kopecks
  currency: "RUB",
  reference: "reference-unique-du-virement-confirme",
  confirmedAt: Date
}
```

Le futur traitement serveur doit assurer l’unicité de la référence de son
prestataire, enregistrer le crédit et cet événement dans la même transaction,
puis appeler `queueIncomingTransferEmail(transferId, session)`. Le futur
traitement KYC appelle `queueKycApprovedEmail(requestId, session)` dans la
transaction de décision. Initialiser `notificationCollection()` **avant** ces
transactions pour que la collection et l’index existent. Après commit, appeler
`deliverEmailsSafely(accountId)` via `after` depuis un Route Handler. Ne jamais
appeler Brevo à l’intérieur d’une transaction MongoDB.

## File d’envoi et reprise

La collection `email_notifications` conserve l’événement, la référence du compte,
les tentatives et le résultat. `sent` signifie **accepté par Brevo**, pas livraison
garantie en boîte de réception. Consulter les logs transactionnels de Brevo pour
les rebonds et la livraison effective.

Chaque événement a une clé unique ; les workers concurrents réclament un bail
atomique. Les reprises réutilisent le même `Message-ID` SMTP pour le suivi. Le
champ historique `idempotencyKey` est conservé en base comme graine de cet
identifiant : aucun changement des dossiers existants n’est nécessaire.
**Le SMTP n’offre pas la déduplication de l’ancienne API.** Si Brevo accepte un
message puis que la connexion est coupée avant sa confirmation, une reprise peut
envoyer un doublon, même avec le même `Message-ID`. Aucune garantie « exactement
une fois » n’est annoncée.
Les erreurs temporaires sont réessayées avec délai croissant, jusqu’à huit
tentatives. Une erreur définitive passe à `failed` avec un code générique, sans
clé SMTP ni données personnelles dans les logs. Les rejets SMTP temporaires
(`4xx`) sont réessayés ; les rejets définitifs, par exemple un destinataire refusé
en `550`, passent à `failed`. Une erreur d’authentification utilise le code
`smtp_authentication_failed` et permet une reprise après correction de la clé.
Après correction, un opérateur
peut remettre l’événement concerné à `queued`, `attempts: 0`,
`nextAttemptAt: new Date()` et `leaseUntil: new Date(0)`.

Sans configuration Brevo complète, les événements restent en file sans bloquer
le site. Ils pourront être envoyés une fois la configuration renseignée. Les
adresses de test terminées par `.invalid` ne sont jamais transmises à Brevo.

`vercel.json` planifie `/api/cron/notifications` chaque jour à 06:00 UTC pour la
reprise. L’envoi initial compte/KYC part immédiatement après la réponse HTTP ;
le cron est un rattrapage. Cette fréquence convient à la limite quotidienne du
plan Hobby. Un événement futur de validation enregistré directement dans la
base sera détecté par ce cron : ce chemin n’est pas instantané. Le traitement
serveur de validation devra appeler le déclencheur directement pour l’immédiateté.

Le cron traite au maximum 25 approbations, 25 refus et 25 virements confirmés par
passage, avec un budget de 15 secondes pour cette détection, puis tente jusqu’à
10 envois dans un budget de 35 secondes. Un dossier
confirmé incohérent est ignoré et compté dans `skipped` ; corriger ses champs
avant une nouvelle tentative. Des envois restants pourront nécessiter plusieurs
passages. Le worker ne traite aucune requête dépourvue de l’en-tête
`Authorization: Bearer <CRON_SECRET>` (secret d’au moins 32 caractères).

## Tests

```sh
node tests/brevo.mjs
node tests/atlas-registration.mjs
node tests/atlas-kyc.mjs
npm run build
```

Le premier test intercepte entièrement Brevo et MongoDB : aucun e-mail réel.
Les deux tests Atlas vérifient les événements dans de vraies transactions avec
des comptes synthétiques `.invalid`, puis suppriment uniquement leurs propres
notifications, comptes et fichiers. Pour tester la livraison réelle, configurer
Brevo puis créer explicitement un compte avec une adresse de test que vous
contrôlez. Aucun envoi réel n’est effectué par les tests automatisés.

Vérification manuelle réelle, sans créer de compte et sans toucher aux dossiers :

```sh
# Connexion, TLS et authentification uniquement : aucun e-mail.
node tests/brevo-live.mjs
# Envoi explicite des cinq notifications à une adresse que vous contrôlez.
node tests/brevo-live.mjs --send --to votre-adresse-de-test@votre-domaine.com
```

Le second mode utilise les modèles et le transport du projet, en ajoutant
`[ТЕСТ]` à l’objet et une mention visible indiquant qu’aucun compte, dossier KYC
ou virement réel n’a été modifié. Il s’arrête au premier échec, sans nouvelle
tentative automatique. Un rapport sans identifiants SMTP est conservé dans
`verification/`, ignoré par Git. L’acceptation SMTP ne confirme pas la réception
en boîte : vérifier les cinq messages chez le destinataire ou dans les logs
transactionnels Brevo.

Les modèles utilisent une mise en page HTML en tableaux sur toute la largeur
disponible, une version mobile et une alternative texte. Aucun encadré extérieur
ni texte de pré-en-tête n'est ajouté. Aucun logo distant, pixel de
suivi ni pièce d'identité n'est inclus. Chaque message affiche le statut de son
événement. Les appels après réponse ciblent leur clé d'événement : une approbation
ne vide pas une ancienne notification de création de compte. Le worker bloque
les incohérences entre la clé et le type du message avant l'envoi SMTP.

Références : [SMTP Brevo](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP),
[transport SMTP Nodemailer](https://nodemailer.com/smtp),
[sécurisation du cron Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
