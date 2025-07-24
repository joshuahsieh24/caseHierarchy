/**
 * KD_CaseHierarchyController
 * --------------------------
 * Returns a tree of CaseWrapper objects for Case, Account, or Opportunity
 * record pages.
 *
 * v2025-07-24  Added childCount and flattened Opportunity mode
 * v2025-07-24b Switched Opportunity lookup to Opportunity__c (custom field)
 */
public with sharing class KD_CaseHierarchyController {

    /* === PUBLIC ENTRY =================================================== */
    @AuraEnabled(cacheable=true)
    public static List<CaseWrapper> getCaseHierarchy(Id recordId, String objectName) {
        if (recordId == null || objectName == null) return new List<CaseWrapper>();

        if (objectName == 'Case')        return buildHierarchyFromCase(recordId);
        if (objectName == 'Account')     return buildHierarchyFromAccount(recordId);
        if (objectName == 'Opportunity') return buildHierarchyFromOpportunity(recordId);

        return new List<CaseWrapper>();
    }

    /* === MODE: CASE ===================================================== */
    private static List<CaseWrapper> buildHierarchyFromCase(Id caseId) {
        List<Case> cases = [
            SELECT Id, CaseNumber, Subject, Status, ParentId
            FROM   Case
            WHERE  Id = :caseId
               OR  ParentId = :caseId
            WITH  SECURITY_ENFORCED
        ];
        return buildTreeFromCases(cases);
    }

    /* === MODE: ACCOUNT ================================================== */
    private static List<CaseWrapper> buildHierarchyFromAccount(Id accountId) {
        List<Case> cases = [
            SELECT Id, CaseNumber, Subject, Status, ParentId
            FROM   Case
            WHERE  AccountId = :accountId
            WITH  SECURITY_ENFORCED
        ];
        return buildTreeFromCases(cases);
    }

    /* === MODE: OPPORTUNITY (flat) ====================================== */
    private static List<CaseWrapper> buildHierarchyFromOpportunity(Id oppId) {

        /* NOTE: uses custom lookup field Opportunity__c */
        List<CaseWrapper> wrappers = new List<CaseWrapper>();
        for (Case c : [
                SELECT Id, CaseNumber, Subject, Status
                FROM   Case
                WHERE  Opportunity__c = :oppId
                WITH   SECURITY_ENFORCED
            ]) {

            wrappers.add(new CaseWrapper(c.Id, c.CaseNumber, c.Subject, c.Status));
        }
        return wrappers;   /* flat list – no parent/child relations */
    }

    /* === HELPER: build tree from a Case list =========================== */
    private static List<CaseWrapper> buildTreeFromCases(List<Case> cases) {

        Map<Id,CaseWrapper> wrapById = new Map<Id,CaseWrapper>();
        for (Case c : cases) {
            wrapById.put(c.Id, new CaseWrapper(c.Id, c.CaseNumber, c.Subject, c.Status));
        }

        /* attach children */
        for (Case c : cases) {
            if (c.ParentId != null && wrapById.containsKey(c.ParentId)) {
                wrapById.get(c.ParentId).children.add(wrapById.get(c.Id));
            }
        }

        /* collect roots & set child counts */
        List<CaseWrapper> roots = new List<CaseWrapper>();
        for (Case c : cases) {
            if (c.ParentId == null || !wrapById.containsKey(c.ParentId)) {
                roots.add(wrapById.get(c.Id));
            }
        }
        setCountsRecursively(roots);
        return roots;
    }

    private static void setCountsRecursively(List<CaseWrapper> nodes) {
        for (CaseWrapper n : nodes) {
            n.childCount = n.children.size();
            setCountsRecursively(n.children);
        }
    }

    /* === INNER WRAPPER ================================================== */
    public class CaseWrapper {
        @AuraEnabled public String  id;
        @AuraEnabled public String  caseNumber;
        @AuraEnabled public String  subject;
        @AuraEnabled public String  status;
        @AuraEnabled public Integer childCount = 0;

        @AuraEnabled public List<CaseWrapper> children = new List<CaseWrapper>();

        /* expose for lightning-tree-grid recursion */
        @AuraEnabled
        public List<CaseWrapper> get_children() { return children; }

        public CaseWrapper(String id, String num, String subj, String stat) {
            this.id         = id;
            this.caseNumber = num;
            this.subject    = subj;
            this.status     = stat;
        }
    }
}
