// express-zod-api augments zod schemas with `.example()` as a side effect of
// being imported. The running app always loads it (via the server config), but
// these tests import the schema/service modules directly, so we load it here to
// apply the augmentation before any schema module is evaluated.
import "express-zod-api";
