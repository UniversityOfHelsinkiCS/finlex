export interface Section {
    '$': {eId: string},
    num: string,
    heading: string | {
        _: string
    },
}


export interface Chapter {
    '$': {eId: string},
    num: string,
    heading: string | {
        _: string
    },
    section: Section[]
}


export interface hContainer {
    akomaNtoso: {
        act: {
            body: {
                hcontainer: [
                    {chapter: Chapter[]} | {section: Section[]}
                ]
            }
        }
    }
}

export interface Heading {
    id: string,
    name: string,
    content: Heading[]
}


