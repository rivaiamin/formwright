// =============================================================================
// templates.ts — starter forms.
//
// Each template is plain SurveyJS JSON, exactly like anything the builder emits.
// Applying one goes through `store.replaceSchema`, so it lands as a single
// undoable step and is validated on save like any other schema.
// =============================================================================

import type { SurveySchema } from './store.svelte';

export interface FormTemplate {
    id: string;
    label: string;
    description: string;
    schema: SurveySchema;
}

export const TEMPLATES: FormTemplate[] = [
    {
        id: 'blank',
        label: 'Blank form',
        description: 'One empty page. Start from scratch.',
        schema: { pages: [{ name: 'page1', elements: [] }] },
    },
    {
        id: 'contact',
        label: 'Contact form',
        description: 'Name, email, subject and a message.',
        schema: {
            title: { default: 'Contact us' },
            completedHtml: {
                default: 'Thanks — we will get back to you shortly.',
            },
            pages: [
                {
                    name: 'page1',
                    elements: [
                        {
                            type: 'text',
                            name: 'full_name',
                            title: { default: 'Your name' },
                            isRequired: true,
                        },
                        {
                            type: 'text',
                            name: 'email',
                            title: { default: 'Email address' },
                            isRequired: true,
                            validators: [{ type: 'email' }],
                        },
                        {
                            type: 'text',
                            name: 'subject',
                            title: { default: 'Subject' },
                        },
                        {
                            type: 'comment',
                            name: 'message',
                            title: { default: 'Message' },
                            isRequired: true,
                            rows: 5,
                        },
                    ],
                },
            ],
        },
    },
    {
        id: 'satisfaction',
        label: 'Customer satisfaction',
        description: 'NPS score, a rating and an open comment.',
        schema: {
            title: { default: 'How did we do?' },
            showProgressBar: 'top',
            completedHtml: { default: 'Thank you for your feedback!' },
            pages: [
                {
                    name: 'page1',
                    elements: [
                        {
                            type: 'rating',
                            name: 'nps',
                            title: {
                                default: 'How likely are you to recommend us?',
                            },
                            rateMax: 10,
                            isRequired: true,
                        },
                        {
                            type: 'radiogroup',
                            name: 'satisfaction',
                            title: {
                                default: 'Overall, how satisfied are you?',
                            },
                            choices: [
                                {
                                    value: 'very_satisfied',
                                    text: { default: 'Very satisfied' },
                                },
                                {
                                    value: 'satisfied',
                                    text: { default: 'Satisfied' },
                                },
                                {
                                    value: 'neutral',
                                    text: { default: 'Neutral' },
                                },
                                {
                                    value: 'dissatisfied',
                                    text: { default: 'Dissatisfied' },
                                },
                            ],
                        },
                        {
                            type: 'comment',
                            name: 'comments',
                            title: { default: 'Anything we could improve?' },
                        },
                    ],
                },
            ],
        },
    },
    {
        id: 'quiz',
        label: 'Quiz',
        description: 'Two scored questions with correct answers.',
        schema: {
            title: { default: 'Quick quiz' },
            showProgressBar: 'top',
            progressBarType: 'correctQuestions',
            pages: [
                {
                    name: 'page1',
                    elements: [
                        {
                            type: 'radiogroup',
                            name: 'capital',
                            title: {
                                default: 'What is the capital of France?',
                            },
                            choices: [
                                { value: 'paris', text: { default: 'Paris' } },
                                { value: 'lyon', text: { default: 'Lyon' } },
                                {
                                    value: 'marseille',
                                    text: { default: 'Marseille' },
                                },
                            ],
                            correctAnswer: 'paris',
                            points: 1,
                        },
                        {
                            type: 'checkbox',
                            name: 'primary_colours',
                            title: { default: 'Select the primary colours' },
                            choices: [
                                { value: 'red', text: { default: 'Red' } },
                                { value: 'green', text: { default: 'Green' } },
                                { value: 'blue', text: { default: 'Blue' } },
                                {
                                    value: 'yellow',
                                    text: { default: 'Yellow' },
                                },
                            ],
                            correctAnswer: ['red', 'blue', 'yellow'],
                            points: 2,
                        },
                    ],
                },
            ],
        },
    },
    {
        id: 'registration',
        label: 'Event registration',
        description: 'Attendee details across two pages, with dietary logic.',
        schema: {
            title: { default: 'Event registration' },
            showProgressBar: 'top',
            pages: [
                {
                    name: 'attendee',
                    title: { default: 'Your details' },
                    elements: [
                        {
                            type: 'text',
                            name: 'full_name',
                            title: { default: 'Full name' },
                            isRequired: true,
                        },
                        {
                            type: 'text',
                            name: 'email',
                            title: { default: 'Email' },
                            isRequired: true,
                            validators: [{ type: 'email' }],
                        },
                        {
                            type: 'text',
                            name: 'company',
                            title: { default: 'Company' },
                        },
                    ],
                },
                {
                    name: 'preferences',
                    title: { default: 'Preferences' },
                    elements: [
                        {
                            type: 'boolean',
                            name: 'dietary_needs',
                            title: {
                                default:
                                    'Do you have any dietary requirements?',
                            },
                        },
                        {
                            type: 'comment',
                            name: 'dietary_details',
                            title: { default: 'Please tell us more' },
                            visibleIf: '{dietary_needs} = true',
                        },
                    ],
                },
            ],
        },
    },
];
