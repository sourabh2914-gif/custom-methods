import type { WalnutContext } from './walnut';
 
/** @walnut_method
* name: Clear Text From Object
* description: Clear text from the linked object
* actionType: custom_clear_text_from_object
* context: web
* needsLocator: true
* category: Forms
*/
export async function clearTextFromObject(ctx: WalnutContext) {
  if (ctx.platform !== 'web') return;
  const locator = (ctx as any).locator;
  if (!locator) throw new Error('No object linked to this step — attach an object in the test case editor');
  await locator.clear();
}