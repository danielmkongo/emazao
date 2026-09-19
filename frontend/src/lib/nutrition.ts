import { Baby, HeartPulse, Milk, UserRound, Stethoscope } from 'lucide-react'

/**
 * The special-nutrition groups. Chosen because they are where food matters
 * most and mistakes cost most: young children, pregnant women, nursing
 * mothers, the sick and the elderly. Sellers tag their own produce, so every
 * place that shows these also shows that it is the farmer's word, not medical
 * advice.
 */
export const NUTRITION_GROUPS = [
  { key: 'CHILDREN', icon: Baby, en: 'Children', sw: 'Watoto',
    enDesc: 'Iron, protein and energy for growing bodies.', swDesc: 'Madini ya chuma, protini na nishati kwa ukuaji.' },
  { key: 'PREGNANT', icon: HeartPulse, en: 'Pregnant women', sw: 'Wajawazito',
    enDesc: 'Folate, iron and calcium during pregnancy.', swDesc: 'Foliki, chuma na kalsiamu wakati wa ujauzito.' },
  { key: 'NURSING', icon: Milk, en: 'Nursing mothers', sw: 'Wamama wanaonyonyesha',
    enDesc: 'Fluids, protein and energy while breastfeeding.', swDesc: 'Maji, protini na nishati wakati wa kunyonyesha.' },
  { key: 'PATIENTS', icon: Stethoscope, en: 'The sick', sw: 'Wagonjwa',
    enDesc: 'Easy to digest, nourishing food for recovery.', swDesc: 'Chakula chepesi kumeng’enya na chenye lishe kwa kupona.' },
  { key: 'ELDERLY', icon: UserRound, en: 'The elderly', sw: 'Wazee',
    enDesc: 'Soft, fibre-rich produce for older adults.', swDesc: 'Mazao laini yenye nyuzinyuzi kwa wazee.' },
] as const

export type NutritionKey = typeof NUTRITION_GROUPS[number]['key']
export const ALL_NUTRITION = NUTRITION_GROUPS.map(g => g.key).join(',')

export const NUTRITION_DISCLAIMER = {
  en: 'These tags are set by the farmers themselves and are not medical advice. For specific dietary needs, consult a health professional.',
  sw: 'Alama hizi zinawekwa na wakulima wenyewe na si ushauri wa kitabibu. Kwa mahitaji maalum ya lishe, wasiliana na mtaalamu wa afya.',
}
