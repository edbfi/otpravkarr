// The app's one import of SvelteKit's private runtime environment. Every reader
// goes through this module (and tests mock it), so moving to SvelteKit 3's
// $app/env/private changes only this file.
export { env } from "$env/dynamic/private";
