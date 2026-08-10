export function parseMessageComponent(component: any): any[] {
  if (!component) return [];
  if (Array.isArray(component)) return component;
  if (typeof component === 'string') {
    try {
      const parsed = JSON.parse(component);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function applyBodyParameters(bodyText: string, bodyParams: any[]): string {
  const text = String(bodyText || '');
  if (!text) return '';

  const matches = text.match(/\{\{\d+\}\}/g) || [];
  return matches.reduce((acc, ph, idx) => {
    const val = bodyParams[idx]?.text ?? '';
    return acc.replace(ph, val);
  }, text);
}

export function buildTemplateDisplayMessage(template: any, component: any): string {
  const templateData = template && typeof template === 'object' ? template : {};
  const components = templateData.components;

  if (!Array.isArray(components)) return '';

  const componentList = parseMessageComponent(component);
  const category = String(templateData.category || '').toUpperCase();
  const bodyComponent = components.find((c: any) => c.type === 'BODY');
  const bodyParams = componentList.find(
    (c: any) => String(c.type || '').toLowerCase() === 'body'
  )?.parameters || [];

  if (category === 'AUTHENTICATION') {
    if (bodyComponent?.text) {
      return applyBodyParameters(bodyComponent.text, bodyParams);
    }

    const code = bodyParams[0]?.text ?? '';
    if (!code) return '';

    let text = `${code} is your verification code.`;
    if (bodyComponent?.add_security_recommendation) {
      text += ' For your security, do not share this code.';
    }
    return text;
  }

  return applyBodyParameters(bodyComponent?.text || '', bodyParams);
}

export function resolveTemplateBodyText(msg: any): string {
  if (msg?.message && String(msg.message).trim() && msg.message !== 'Template sent') {
    return msg.message;
  }

  const template = msg?.template || {};
  const componentList = parseMessageComponent(msg?.component);
  return buildTemplateDisplayMessage(template, componentList) || '(Empty Template)';
}

export function getTemplateHeaderMedia(msg: any): { type: string, url: string, filename?: string } | null {
  const template = msg?.template || {};
  const components = template.components;
  if (!Array.isArray(components)) return null;

  const header = components.find((c: any) => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format));
  if (!header) return null;

  const componentList = parseMessageComponent(msg?.component);
  const headerParams = componentList.find((c: any) => String(c.type || '').toLowerCase() === 'header')?.parameters || [];
  
  if (headerParams.length > 0) {
    const param = headerParams[0];
    if (param.type === 'document' && param.document?.link) {
      return { type: 'document', url: param.document.link, filename: param.document.filename };
    }
    if (param.type === 'image' && param.image?.link) {
      return { type: 'image', url: param.image.link };
    }
    if (param.type === 'video' && param.video?.link) {
      return { type: 'video', url: param.video.link };
    }
  }

  return null;
}
