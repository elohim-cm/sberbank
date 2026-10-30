# Inscription et tableau de bord avec MongoDB Atlas

Le serveur Next.js enregistre les profils dans Atlas. Le navigateur ne reçoit
jamais la chaîne de connexion. Aucune base de données locale supplémentaire
n'est nécessaire.

## Configuration

Dans `.env.local` (ignoré par Git) :

```dotenv
DATABASE_MONGODB_URI=votre_connexion_atlas
MONGODB_DB=bank
```

`MONGODB_URI` est également accepté. `MONGODB_DB` est optionnel et vaut `bank`
par défaut. Les collections `accounts` et `sessions`, l'index unique des e-mails
et l'index d'expiration des sessions sont créés automatiquement.

Sur Vercel, définir les mêmes variables côté serveur dans les environnements
concernés, puis redéployer. `.env.local` n'est pas envoyé par `git push`.
Le compte technique Atlas doit pouvoir lire/écrire et créer les index dans la
base choisie ; l'accès réseau Atlas doit autoriser l'environnement d'exécution.

Si le DNS local refuse les recherches SRV (`querySrv ECONNREFUSED`), une variable
optionnelle `MONGODB_DNS_SERVERS` peut désigner un résolveur explicitement autorisé,
par exemple `1.1.1.1`. Elle ne change que le résolveur DNS du processus Node.js.
Ne pas la recopier sur Vercel si son résolveur fonctionne normalement.

## Parcours

- L'inscription valide les champs côté navigateur et côté serveur.
- Un succès n'est affiché qu'après validation de la transaction Atlas qui crée
  le compte et sa session. Une adresse e-mail déjà utilisée est refusée.
- La session utilise un cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production,
  valable sept jours. Seule l'empreinte du jeton est enregistrée dans Atlas.
- Le tableau de bord relit le profil de la session dans Atlas à chaque navigation
  serveur/rechargement. Les paramètres d'URL ne permettent pas de choisir un
  autre compte ou de changer le produit enregistré.
- La déconnexion révoque la session ; elle ne supprime pas le compte.
- La récupération de compte et la connexion depuis un autre navigateur restent
  à implémenter. L'onglet « Вход » reprend uniquement une session existante.
- Ce changement concerne les données d'inscription. L'envoi des photos KYC et
  leur stockage durable ne font pas partie de cette intégration.

## Vérification réelle

Démarrer le site sur le port 3000, puis :

```sh
node tests/atlas-registration.mjs
```

Le test crée deux profils synthétiques uniques, vérifie tous les champs dans
Atlas, contrôle leur restitution dans le tableau de bord, l'isolation des comptes,
la validation et la déconnexion. Il supprime uniquement ses propres comptes et
sessions à la fin. Il ne doit jamais être exécuté avec des données personnelles
réelles à la place des données de test intégrées.
