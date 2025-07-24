/* =====================================================================
   Class: KD_CaseHierarchyController
   Purpose:
     – Provide a single Apex endpoint (getCaseHierarchy) that
       returns Case data in the right shape for lightning-tree-grid.
     – Behaviour changes automatically based on WHERE the component
       is used (Account, Opportunity, or Case record page).

   NOTE • “Opportunity__c” is assumed to be the custom lookup field
         that links Case → Opportunity in your org.  Change the
         API-name if your field is different, or comment that block
         out if you don’t track Cases to Opportunities.
   ===================================================================== */
   public with sharing class KD_CaseHierarchyController {

    /* ---------------------------------------------------------------
       getCaseHierarchy
       • recordId     – Id of the record hosting the component
       • objectName   – Object API name (“Case”, “Account”, “Opportunity”)
       • Returns      – List<CaseWrapper> for <lightning-tree-grid>
       --------------------------------------------------------------- */
    @AuraEnabled(cacheable=true)
    public static List<CaseWrapper> getCaseHierarchy(Id recordId, String objectName) {

        /* 1) Component sits on a Case record  ----------------------- */
        if (objectName == 'Case') {
            return buildHierarchyFromCase(recordId);
        }

        /* 2) Component sits on an Account record -------------------- */
        if (objectName == 'Account') {
            List<Case> cases = [
                SELECT Id, CaseNumber, Subject, Status, ParentId
                FROM   Case
                WHERE  AccountId = :recordId          // all Cases for Account
                WITH   SECURITY_ENFORCED
            ];
            return buildTreeFromCases(cases);
        }

        /* 3) Component sits on an Opportunity record ---------------- */
        if (objectName == 'Opportunity') {
            List<CaseWrapper> flat = new List<CaseWrapper>();
            for (Case c : [
                SELECT Id, CaseNumber, Subject, Status
                FROM   Case
                WHERE  Opportunity__c = :recordId     // <-- change if API name differs
                WITH   SECURITY_ENFORCED
            ]) {
                flat.add(new CaseWrapper(c.Id, c.CaseNumber, c.Subject, c.Status));
            }
            return flat;                              // flat list – no sub-case roll-up
        }

        /* Fallback (unexpected host object) ------------------------- */
        return new List<CaseWrapper>();
    }

    /* ===============================================================
       buildHierarchyFromCase
       – Returns the clicked Case + its immediate children
       – Removed illegal self-sub-query to keep SOQL valid
       =============================================================== */
    private static List<CaseWrapper> buildHierarchyFromCase(Id caseId) {
        List<Case> cases = [
            SELECT Id, CaseNumber, Subject, Status, ParentId
            FROM   Case
            WHERE  Id = :caseId
                OR ParentId = :caseId                // 1-level of children
            WITH  SECURITY_ENFORCED
        ];
        return buildTreeFromCases(cases);
    }

    /* ===============================================================
       buildTreeFromCases
       – Converts a flat List<Case> into a rooted tree of CaseWrapper
       – Parent/child linkage is done in-memory
       =============================================================== */
    private static List<CaseWrapper> buildTreeFromCases(List<Case> cases) {

        /* 1. Wrap every Case record -------------------------------- */
        Map<Id, CaseWrapper> wrapById = new Map<Id, CaseWrapper>();
        for (Case c : cases) {
            wrapById.put(
                c.Id,
                new CaseWrapper(c.Id, c.CaseNumber, c.Subject, c.Status)
            );
        }

        /* 2. Stitch children under their parent -------------------- */
        for (Case c : cases) {
            if (c.ParentId != null && wrapById.containsKey(c.ParentId)) {
                wrapById.get(c.ParentId).children.add(wrapById.get(c.Id));
            }
        }

        /* 3. Emit only root-level nodes ---------------------------- */
        List<CaseWrapper> roots = new List<CaseWrapper>();
        for (Case c : cases) {
            if (c.ParentId == null) {
                roots.add(wrapById.get(c.Id));
            }
        }
        return roots;
    }

    /* ===============================================================
       Inner DTO: CaseWrapper
       – Holds columns + child list for lightning-tree-grid
       – Exposes “_children” via getter (tree-grid convention)
       =============================================================== */
    public class CaseWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String caseNumber;
        @AuraEnabled public String subject;
        @AuraEnabled public String status;

        @AuraEnabled public List<CaseWrapper> children = new List<CaseWrapper>();

        // Expose property as “_children” for tree-grid recursion
        @AuraEnabled public List<CaseWrapper> get_children() {
            return children;
        }

        /* Constructors --------------------------------------------- */
        public CaseWrapper() {} // for serialization
        public CaseWrapper(String id, String num, String subj, String stat) {
            this.id        = id;
            this.caseNumber = num;
            this.subject    = subj;
            this.status     = stat;
        }
    }
}
