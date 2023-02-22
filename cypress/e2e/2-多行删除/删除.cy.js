/// <reference types="cypress" />

context('Actions', () => {
  beforeEach(() => {
    cy.visit('http://127.0.0.1:5173/testsite/')
  })

  // https://on.cypress.io/interacting-with-elements

  it('.type() - type into a DOM element', () => {
    // https://on.cypress.io/type
    cy.get('.CodeMirror').type('fake@email.com')
  })
})
