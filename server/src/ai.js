// Adapt application requests to Cloudflare image and text inference APIs.
// Image generation returns base64 bytes; text generation returns parsed creature metadata.

const IMAGE_MODEL = '@cf/black-forest-labs/flux-2-klein-4b'
const TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct'
const ALLOWED_TYPES = [
  'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison',
  'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark',
  'Steel', 'Fairy',
]
const STYLE_PROMPTS = {
  cute: 'Use an irresistibly cute storybook-creature style with friendly shapes and expressive features.',
  fierce: 'Use a fierce heroic fantasy-creature style with a powerful stance, dramatic shapes, and intense energy.',
  realistic: 'Use a believable semi-realistic wildlife-fantasy style with natural anatomy, detailed materials, and cinematic light.',
  anime: 'Use an original modern anime-inspired creature style with clean linework, expressive eyes, and dynamic cel shading.',
  cartoon: 'Use a playful original cartoon style with bold silhouettes, lively expressions, and clean colorful shapes.',
  watercolor: 'Use a hand-painted watercolor storybook style with textured paper, soft pigment blooms, and delicate ink accents.',
}

// Request-specific credentials take precedence over server environment settings.
function getCloudflareConfig(overrides = {}) {
  const accountId = overrides.accountId || process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = overrides.apiToken || process.env.CLOUDFLARE_API_TOKEN
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Account ID and API token are required')
  }
  return { accountId, apiToken }
}

// Send either multipart image input or JSON text input, and report upstream failures.
async function runModel(model, input, credentials) {
  const { accountId, apiToken } = getCloudflareConfig(credentials)
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`
  const isMultipart = input instanceof FormData
  const response = await fetch(url, {
    method: 'POST',
    headers: isMultipart
      ? { Authorization: `Bearer ${apiToken}` }
      : {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
    body: isMultipart ? input : JSON.stringify(input),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Cloudflare Workers AI returned ${response.status}: ${detail}`)
  }
  return response
}

// The image endpoint can return JSON-wrapped base64 or raw image bytes.
// Normalize both response shapes to base64 for the storage layer.
async function generateImage({ prompt, imageBase64, width = 496, height = 496, guidance = 4 }, credentials) {
  const form = new FormData()
  form.append('prompt', prompt)
  form.append('width', String(width))
  form.append('height', String(height))
  form.append('guidance', String(guidance))
  if (imageBase64) {
    const image = new Blob([Buffer.from(imageBase64, 'base64')], { type: 'image/png' })
    form.append('input_image_0', image, 'reference.png')
  }

  const response = await runModel(IMAGE_MODEL, form, credentials)
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const payload = await response.json()
    const image = payload?.result?.image || payload?.result
    if (typeof image !== 'string') {
      throw new Error('Cloudflare Workers AI returned no image data')
    }
    return image.replace(/^data:image\/\w+;base64,/, '')
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  if (!bytes.length) throw new Error('Cloudflare Workers AI returned an empty image')
  return bytes.toString('base64')
}

async function loadImageBase64(source) {
  if (!source) return null
  if (source.startsWith('data:image/')) {
    const comma = source.indexOf(',')
    return comma >= 0 ? source.slice(comma + 1) : null
  }
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const response = await fetch(source)
    if (!response.ok) throw new Error(`Could not load reference image (${response.status})`)
    return Buffer.from(await response.arrayBuffer()).toString('base64')
  }
  return null
}

// Remove optional Markdown fences and surrounding text before parsing the object.
// Parsing checks JSON syntax; the API still needs to normalize the resulting fields.
function parseJsonResponse(text) {
  if (text && typeof text === 'object' && !Array.isArray(text)) return text
  if (typeof text !== 'string') {
    throw new Error('Workers AI returned metadata in an unsupported format')
  }
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Workers AI returned invalid metadata')
  return JSON.parse(cleaned.slice(start, end + 1))
}

export async function generateImageFromDoodle(base64Png, credentials, style = 'cute') {
  return generateImage({
    prompt: [
      'Create a polished original fantasy battle creature based closely on image 0.',
      'Preserve its silhouette, major colors, and recognizable features.',
      'Render a lively digital creature illustration, not a toy or plush.',
      'Place it in a clean stylized arena with subtle stadium lighting and soft bokeh.',
      STYLE_PROMPTS[style] || STYLE_PROMPTS.cute,
    ].join(' '),
    imageBase64: base64Png,
    guidance: 4,
  }, credentials)
}

export async function generatePalMetadata(promptText, credentials, style = 'cute') {
  const prompt = [
    promptText || 'Design an original fantasy battle creature.',
    'Return JSON only with fields: name, type, characteristics, stats, powers.',
    'characteristics must be one or two vivid sentences describing personality, appearance, habits, and one charmingly specific quirk; do not return an object.',
    'stats must be an object with numeric attack, defense, health, and speed values from 1 to 150.',
    `type must be an array containing one or two of: ${ALLOWED_TYPES.join(', ')}.`,
    'powers must contain exactly two objects with name and description fields.',
    'Every power description must explicitly use the generated creature name.',
    'Invent an original, pronounceable name with varied rhythm and 2 to 4 syllables. Avoid names or fragments associated with existing famous monster franchises.',
    'Vary the tone and vocabulary between generations; avoid generic phrases such as always ready for battle, fierce warrior, or mysterious creature.',
    `The selected visual style is ${style}; let that influence the vocabulary and personality without using the style word in every field.`,
  ].join(' ')

  const input = {
    messages: [
      { role: 'system', content: 'You are a playful creature designer with a wide vocabulary. Create distinct names and memorable personality details, and output strict JSON only.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.95,
    max_tokens: 650,
  }
  const response = await runModel(TEXT_MODEL, input, credentials)
  const payload = await response.json()
  const text = payload?.result?.response
  if (!text) throw new Error('Cloudflare Workers AI returned no metadata')
  try {
    return parseJsonResponse(text)
  } catch (parseError) {
    // If the initial text is malformed, make one low-temperature repair request.
    // A second parsing failure is allowed to propagate to the route error handler.
    const repairResponse = await runModel(TEXT_MODEL, {
      messages: [
        { role: 'system', content: 'Repair malformed JSON. Return only one valid JSON object, preserving the original meaning and required fields.' },
        { role: 'user', content: `Repair this response without commentary:\n${text}` },
      ],
      temperature: 0,
      max_tokens: 700,
    }, credentials)
    const repairedPayload = await repairResponse.json()
    const repairedText = repairedPayload?.result?.response
    if (!repairedText) throw parseError
    return parseJsonResponse(repairedText)
  }
}

// Use the original artwork as a reference to preserve the creature in a new action scene.
export async function generateActionImage({ baseImageDataUrl, name, type, characteristics }, power, credentials) {
  const base64Img = await loadImageBase64(baseImageDataUrl)
  if (!base64Img) throw new Error('A base creature image is required for an action image')

  return generateImage({
    prompt: [
      `Transform image 0 into the same creature, ${name || 'the creature'}, performing ${power?.name || 'a dynamic attack'}.`,
      power?.description || '',
      `Type: ${Array.isArray(type) ? type.join('/') : type || 'Unknown'}.`,
      characteristics || '',
      'Use a dynamic three-quarter camera angle, an energetic pose, motion effects, and a stylized arena background.',
    ].filter(Boolean).join(' '),
    imageBase64: base64Img,
    guidance: 4,
  }, credentials)
}
